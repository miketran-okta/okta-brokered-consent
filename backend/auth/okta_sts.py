"""
OAuth-STS Token Exchange for Brokered Consent

Exchanges a user's Okta ID token for a GitHub access token via OAuth-STS.
This implements Okta's Brokered Consent flow for AI Agents.

Flow (per Okta documentation):
1. User authenticates with Okta (gets ID token from LINKED application)
2. AI Agent makes OAuth-STS token exchange request
3. First request returns "interaction_required" error with interaction_uri
4. User is redirected to interaction_uri to authorize at GitHub
5. After user authorizes, retry OAuth-STS request to get access_token

Token Exchange Parameters:
- grant_type: urn:ietf:params:oauth:grant-type:token-exchange
- requested_token_type: urn:okta:params:oauth:token-type:oauth-sts
- subject_token: User's ID token (from linked application)
- subject_token_type: urn:ietf:params:oauth:token-type:id_token
- client_assertion_type: urn:ietf:params:oauth:client-assertion-type:jwt-bearer
- client_assertion: Signed JWT from jwt_builder
- resource: Resource indicator from Managed Connection
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import httpx
import base64
import json

from .agent_config import get_agent_config, AgentConfig
from .jwt_builder import JWTBuilderFactory

logger = logging.getLogger(__name__)

# OAuth-STS Grant Types and Token Types
GRANT_TYPE_TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange"
REQUESTED_TOKEN_TYPE_STS = "urn:okta:params:oauth:token-type:oauth-sts"
SUBJECT_TOKEN_TYPE_ID = "urn:ietf:params:oauth:token-type:id_token"
CLIENT_ASSERTION_TYPE_JWT = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"


def _decode_jwt_part(encoded: str) -> Dict[str, Any]:
    """Decode a base64url encoded JWT part."""
    try:
        # Add padding if needed
        padding = 4 - len(encoded) % 4
        if padding != 4:
            encoded += '=' * padding
        decoded = base64.urlsafe_b64decode(encoded)
        return json.loads(decoded)
    except Exception as e:
        logger.error(f"[JWT Decode] Failed to decode part: {e}")
        return {}


def _decode_jwt_full(token: str) -> Dict[str, Any]:
    """
    Decode JWT and extract header, payload, and signature info.
    Returns full decoded token details for UI display.
    Handles non-JWT tokens (opaque tokens like GitHub's gho_*) gracefully.
    """
    if not token:
        return {"error": "No token provided"}

    try:
        parts = token.split('.')

        # Check if it's a JWT (3 parts) or an opaque token
        if len(parts) != 3:
            # This is likely an opaque token (e.g., GitHub's gho_* tokens)
            # Return info about the opaque token without logging a warning
            token_type = "opaque"
            if token.startswith("gho_"):
                token_type = "GitHub App Token (opaque)"
            elif token.startswith("ghp_"):
                token_type = "GitHub Personal Access Token (opaque)"
            elif token.startswith("ghu_"):
                token_type = "GitHub User Access Token (opaque)"

            return {
                "header": {"type": "opaque"},
                "payload": {
                    "token_type": token_type,
                    "note": "This is an opaque token, not a JWT. GitHub uses opaque tokens for API access."
                },
                "signature_preview": None,
                "raw_token_preview": token[:20] + "..." if len(token) > 20 else token
            }

        header = _decode_jwt_part(parts[0])
        payload = _decode_jwt_part(parts[1])

        # Mask sensitive parts of signature for display
        signature_preview = parts[2][:20] + "..." if len(parts[2]) > 20 else parts[2]

        return {
            "header": header,
            "payload": payload,
            "signature_preview": signature_preview,
            "raw_token_preview": token[:50] + "..." if len(token) > 50 else token
        }
    except Exception as e:
        logger.error(f"[JWT Decode] Failed to decode token: {e}")
        return {"error": str(e)}


def _decode_jwt_claims(token: str) -> Dict[str, Any]:
    """
    Decode JWT and extract claims without signature verification.
    Used to extract scope information from access tokens.
    Returns empty dict for opaque tokens (not an error - expected for GitHub).
    """
    try:
        # Split the JWT into parts
        parts = token.split('.')
        if len(parts) != 3:
            # Not a JWT - likely an opaque token (e.g., GitHub's gho_* tokens)
            # This is expected, not an error
            return {}

        # Decode the payload (second part)
        payload = parts[1]
        # Add padding if needed
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding

        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)
        return claims
    except Exception as e:
        logger.error(f"[JWT Decode] Failed to decode token: {e}")
        return {}


def _extract_scopes(token: str) -> List[str]:
    """Extract scopes from JWT access token."""
    claims = _decode_jwt_claims(token)

    # Try common scope claim names
    scopes = []
    if 'scp' in claims:
        # Okta uses 'scp' for scopes (can be string or array)
        scp = claims['scp']
        if isinstance(scp, list):
            scopes = scp
        elif isinstance(scp, str):
            scopes = scp.split(' ')
    elif 'scope' in claims:
        # Some providers use 'scope'
        scope = claims['scope']
        if isinstance(scope, list):
            scopes = scope
        elif isinstance(scope, str):
            scopes = scope.split(' ')

    return [s for s in scopes if s]  # Filter empty strings


class OktaSTSExchange:
    """
    Handles OAuth-STS token exchange for service access (GitHub, Jira, etc.).

    Exchanges user ID tokens for service access tokens via Okta Brokered Consent.
    Handles the interaction_required flow for first-time consent.
    """

    def __init__(self, resource_indicator: Optional[str] = None, scopes: Optional[List[str]] = None):
        """
        Initialize the STS exchange handler.

        Args:
            resource_indicator: Optional resource indicator. If not provided,
                               uses the default GitHub resource indicator from config.
            scopes: Optional list of scopes to request (required for Jira)
        """
        self._config = get_agent_config()
        self._jwt_builder = JWTBuilderFactory.get_builder()
        # Allow override of resource indicator for different services (GitHub, Jira, etc.)
        self._resource_indicator = resource_indicator or self._config.resource_indicator
        self._scopes = scopes or []

    def is_configured(self) -> bool:
        """Check if STS exchange is properly configured."""
        return bool(
            self._config.agent_id and
            self._config.private_key and
            self._resource_indicator and
            self._jwt_builder
        )

    def _build_token_exchange_payload(self, user_id_token: str) -> Tuple[Dict[str, str], Dict[str, Any]]:
        """
        Build the OAuth-STS token exchange request payload.

        Returns:
            tuple: (payload dict, token_details dict for UI)
        """
        client_assertion = self._jwt_builder.build_client_assertion(
            principal_id=self._config.agent_id,
            audience=self._config.token_endpoint
        )

        payload = {
            "grant_type": GRANT_TYPE_TOKEN_EXCHANGE,
            "requested_token_type": REQUESTED_TOKEN_TYPE_STS,
            "subject_token": user_id_token,
            "subject_token_type": SUBJECT_TOKEN_TYPE_ID,
            "client_assertion_type": CLIENT_ASSERTION_TYPE_JWT,
            "client_assertion": client_assertion,
            "resource": self._resource_indicator,
        }

        # Add scope parameter if scopes are specified (required for Jira)
        if self._scopes:
            payload["scope"] = " ".join(self._scopes)
            logger.info(f"[OAuth-STS] Requesting scopes: {payload['scope']}")

        # Decode tokens for UI display
        id_token_details = _decode_jwt_full(user_id_token)
        client_assertion_details = _decode_jwt_full(client_assertion)

        token_details = {
            "id_token": {
                "decoded": id_token_details,
                "token_preview": user_id_token[:60] + "..." if len(user_id_token) > 60 else user_id_token
            },
            "client_assertion": {
                "decoded": client_assertion_details,
                "token_preview": client_assertion[:60] + "..." if len(client_assertion) > 60 else client_assertion
            }
        }

        return payload, token_details

    async def exchange_token(
        self,
        user_id_token: str,
    ) -> Dict[str, Any]:
        """
        Exchange user's ID token for GitHub access token.

        This may return interaction_required on first attempt, requiring
        user to authorize at GitHub before retrying.

        Args:
            user_id_token: User's Okta ID token (from linked application via NextAuth)

        Returns:
            Dict with:
            - success: bool
            - access_token: str (GitHub token if successful)
            - token_type: str
            - expires_in: int
            - interaction_required: bool (if user needs to authorize at ISV)
            - interaction_uri: str (URL to redirect user for authorization)
            - error: str (if failed)
            - exchange_details: dict (for UI visualization)
        """
        if not self.is_configured():
            return self._demo_result(user_id_token)

        try:
            # Build token exchange payload and get token details for UI
            payload, token_details = self._build_token_exchange_payload(user_id_token)

            logger.info(f"[OAuth-STS] Exchanging token for resource: {self._resource_indicator}")
            logger.info(f"[OAuth-STS] Token endpoint: {self._config.token_endpoint}")
            logger.info(f"[OAuth-STS] Grant type: {payload['grant_type']}")
            logger.info(f"[OAuth-STS] Requested token type: {payload['requested_token_type']}")

            # Make the token exchange request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._config.token_endpoint,
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=30.0
                )

            logger.info(f"[OAuth-STS] Response status: {response.status_code}")

            # Success - got the access token
            if response.status_code == 200:
                token_data = response.json()
                access_token = token_data.get("access_token")

                # Extract scopes from the JWT access token
                scopes = _extract_scopes(access_token) if access_token else []

                # Decode the access token for UI display
                access_token_details = _decode_jwt_full(access_token) if access_token else {}

                logger.info(f"[OAuth-STS] Token exchange SUCCESS, expires_in={token_data.get('expires_in')}")
                logger.info(f"[OAuth-STS] Extracted scopes: {scopes}")

                # Add access token to token_details
                token_details["access_token"] = {
                    "decoded": access_token_details,
                    "token_preview": access_token[:60] + "..." if access_token and len(access_token) > 60 else access_token,
                    "token_type": token_data.get("token_type", "Bearer"),
                    "expires_in": token_data.get("expires_in"),
                }

                return {
                    "success": True,
                    "access_token": access_token,
                    "token_type": token_data.get("token_type", "Bearer"),
                    "expires_in": token_data.get("expires_in"),
                    "refresh_token": token_data.get("refresh_token"),
                    "scopes": scopes,  # Real scopes from JWT
                    "interaction_required": False,
                    "interaction_uri": None,
                    "demo_mode": False,
                    "token_details": token_details,  # All decoded tokens for UI
                    "exchange_details": {
                        "flow": "OAuth-STS (Brokered Consent)",
                        "agent": self._config.name,
                        "resource": self._resource_indicator,
                        "status": "token_granted",
                        "exchanged_at": datetime.now().isoformat(),
                    }
                }

            # Handle error responses
            error_data = {}
            if response.headers.get("content-type", "").startswith("application/json"):
                try:
                    error_data = response.json()
                except:
                    pass

            error_code = error_data.get("error", "unknown_error")
            error_description = error_data.get("error_description", response.text)
            interaction_uri = error_data.get("interaction_uri")

            logger.warning(f"[OAuth-STS] Token exchange response: error={error_code}, interaction_uri={interaction_uri}")

            # Check for interaction_required - user needs to authorize at GitHub
            if error_code == "interaction_required":
                logger.info(f"[OAuth-STS] Interaction required - user must authorize at ISV")

                # Build the redirect URL if we have interaction_uri or dataHandle
                redirect_uri = interaction_uri
                if not redirect_uri:
                    # Try to extract dataHandle and build the URL
                    data_handle = error_data.get("dataHandle")
                    if data_handle:
                        redirect_uri = f"{self._config.okta_domain}/oauth2/v1/sts/redirect?dataHandle={data_handle}"

                return {
                    "success": False,
                    "access_token": None,
                    "interaction_required": True,
                    "interaction_uri": redirect_uri,
                    "error": "User authorization required at GitHub",
                    "error_code": error_code,
                    "error_description": error_description,
                    "demo_mode": False,
                    "token_details": token_details,  # Include ID token and client assertion even on interaction_required
                    "exchange_details": {
                        "flow": "OAuth-STS (Brokered Consent)",
                        "agent": self._config.name,
                        "resource": "GitHub",
                        "status": "interaction_required",
                        "message": "Please authorize the DevOps Agent to access your GitHub account",
                    }
                }

            # Check for consent_required (alternative error code)
            if error_code == "consent_required" or "consent" in error_description.lower():
                return {
                    "success": False,
                    "access_token": None,
                    "interaction_required": True,
                    "interaction_uri": interaction_uri,
                    "error": "User consent required for GitHub access",
                    "error_code": error_code,
                    "demo_mode": False,
                    "exchange_details": {
                        "flow": "OAuth-STS (Brokered Consent)",
                        "agent": self._config.name,
                        "resource": "GitHub",
                        "status": "consent_required",
                    }
                }

            # Check for access denied
            if error_code in ["access_denied", "unauthorized_client", "invalid_grant"]:
                return {
                    "success": False,
                    "access_token": None,
                    "interaction_required": False,
                    "interaction_uri": None,
                    "error": f"Access denied: {error_description}",
                    "error_code": error_code,
                    "demo_mode": False,
                    "exchange_details": {
                        "flow": "OAuth-STS (Brokered Consent)",
                        "agent": self._config.name,
                        "resource": "GitHub",
                        "status": "access_denied",
                    }
                }

            # Generic error
            return {
                "success": False,
                "access_token": None,
                "interaction_required": False,
                "interaction_uri": None,
                "error": f"{error_code}: {error_description}",
                "error_code": error_code,
                "demo_mode": False,
            }

        except httpx.TimeoutException:
            logger.error("[OAuth-STS] Token exchange timeout")
            return {
                "success": False,
                "access_token": None,
                "interaction_required": False,
                "interaction_uri": None,
                "error": "Token exchange timeout",
                "error_code": "timeout",
                "demo_mode": False,
            }
        except Exception as e:
            logger.error(f"[OAuth-STS] Token exchange error: {e}")
            return {
                "success": False,
                "access_token": None,
                "interaction_required": False,
                "interaction_uri": None,
                "error": str(e),
                "error_code": "exchange_error",
                "demo_mode": False,
            }

    def _demo_result(self, user_id_token: str = "") -> Dict[str, Any]:
        """Return demo mode result when OAuth-STS is not configured."""
        now = int(datetime.now().timestamp())

        # Create demo token details for UI
        demo_token_details = {
            "id_token": {
                "decoded": {
                    "header": {"alg": "RS256", "kid": "demo-key-id"},
                    "payload": {
                        "iss": "https://demo.okta.com",
                        "sub": "demo-user-id",
                        "aud": "demo-client-id",
                        "iat": now,
                        "exp": now + 3600,
                        "email": "demo@example.com",
                        "name": "Demo User"
                    }
                },
                "token_preview": user_id_token[:60] + "..." if user_id_token and len(user_id_token) > 60 else (user_id_token or "demo-id-token...")
            },
            "client_assertion": {
                "decoded": {
                    "header": {"alg": "RS256", "kid": "demo-agent-key"},
                    "payload": {
                        "iss": "demo-agent-id",
                        "sub": "demo-agent-id",
                        "aud": "https://demo.okta.com/oauth2/v1/token",
                        "iat": now,
                        "exp": now + 60,
                        "jti": "demo-jti-" + str(now)
                    }
                },
                "token_preview": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImRlbW8ta2V5In0..."
            },
            "access_token": {
                "decoded": {
                    "header": {"alg": "RS256", "typ": "JWT"},
                    "payload": {
                        "iss": "https://github.com",
                        "sub": "demo-github-user",
                        "aud": "demo-github-app",
                        "iat": now,
                        "exp": now + 3600,
                        "scp": ["repo", "read:user", "read:org"]
                    }
                },
                "token_preview": f"gho_demo_token_{now}...",
                "token_type": "Bearer",
                "expires_in": 3600
            }
        }

        return {
            "success": True,
            "access_token": f"demo-github-token-{now}",
            "token_type": "Bearer",
            "expires_in": 3600,
            "scopes": ["repo", "read:user", "read:org"],
            "interaction_required": False,
            "interaction_uri": None,
            "demo_mode": True,
            "token_details": demo_token_details,
            "exchange_details": {
                "flow": "OAuth-STS (Demo Mode)",
                "agent": "DevOps Agent",
                "resource": "GitHub",
                "note": "Real OAuth-STS not configured - using demo token",
            }
        }


# Singleton instance
_sts_exchange: Optional[OktaSTSExchange] = None


def get_sts_exchange() -> OktaSTSExchange:
    """Get or create the OktaSTSExchange singleton."""
    global _sts_exchange
    if _sts_exchange is None:
        _sts_exchange = OktaSTSExchange()
    return _sts_exchange

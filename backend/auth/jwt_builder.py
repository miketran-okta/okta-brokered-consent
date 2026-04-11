"""
JWT Builder for OAuth-STS Client Assertions

Builds JWT tokens for the client_assertion parameter in OAuth-STS token exchange.
The JWT is signed with the AI agent's private JWK key using RS256.

JWT Structure:
- Header: {kid, alg: RS256}
- Payload: {iss, sub, aud, iat, exp, jti}
- Signature: RS256 signed
"""

import json
import time
import uuid
import logging
from typing import Dict, Any, Optional

from jwcrypto import jwk, jwt
from jwcrypto.common import json_encode

logger = logging.getLogger(__name__)


class JWTBuilder:
    """
    Builds client assertion JWTs for OAuth-STS token exchange.

    The JWT proves the AI agent's identity to Okta during token exchange.
    """

    def __init__(self, private_jwk: Dict[str, Any]):
        """
        Initialize with the AI agent's private JWK.

        Args:
            private_jwk: Private JWK dict (must include 'd' parameter for signing)
        """
        self._key = jwk.JWK(**private_jwk)
        self._kid = private_jwk.get("kid")
        logger.info(f"JWTBuilder initialized with kid={self._kid}")

    def build_client_assertion(
        self,
        principal_id: str,
        audience: str,
        expires_in: int = 60
    ) -> str:
        """
        Build a client assertion JWT for OAuth-STS.

        Args:
            principal_id: The AI agent ID (wlp...) - used as iss and sub
            audience: Token endpoint URL (e.g., https://domain/oauth2/v1/token)
            expires_in: JWT lifetime in seconds (default: 60)

        Returns:
            Signed JWT string
        """
        now = int(time.time())

        # JWT Header
        header = {
            "kid": self._kid,
            "alg": "RS256"
        }

        # JWT Payload
        payload = {
            "iss": principal_id,
            "sub": principal_id,
            "aud": audience,
            "iat": now,
            "exp": now + expires_in,
            "jti": str(uuid.uuid4())
        }

        # Create and sign the JWT
        token = jwt.JWT(header=header, claims=payload)
        token.make_signed_token(self._key)

        signed_jwt = token.serialize()

        logger.debug(f"Built client assertion JWT: iss={principal_id}, aud={audience}, exp={now + expires_in}")

        return signed_jwt


class JWTBuilderFactory:
    """Factory for creating JWTBuilder instances from environment config."""

    _instance: Optional[JWTBuilder] = None

    @classmethod
    def get_builder(cls, private_jwk_str: Optional[str] = None) -> Optional[JWTBuilder]:
        """
        Get or create a JWTBuilder singleton.

        Args:
            private_jwk_str: JSON string of private JWK (from env var)

        Returns:
            JWTBuilder instance or None if not configured
        """
        if cls._instance is not None:
            return cls._instance

        if not private_jwk_str:
            import os
            private_jwk_str = os.getenv("OKTA_AI_AGENT_PRIVATE_KEY", "")

        if not private_jwk_str:
            logger.warning("No private JWK configured - JWT builder unavailable")
            return None

        try:
            private_jwk = json.loads(private_jwk_str)
            cls._instance = JWTBuilder(private_jwk)
            return cls._instance
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse private JWK: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to initialize JWTBuilder: {e}")
            return None

    @classmethod
    def reset(cls):
        """Reset the singleton (for testing)."""
        cls._instance = None

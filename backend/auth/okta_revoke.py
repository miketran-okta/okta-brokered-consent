"""
Okta Token Revocation

Programmatically revoke OAuth-STS tokens to force fresh authorization.
This clears Okta's cache and ensures the next OAuth-STS request
returns interaction_required with interaction_uri.
"""

import logging
import httpx
from typing import Dict, Any

from .agent_config import get_agent_config
from .jwt_builder import JWTBuilderFactory

logger = logging.getLogger(__name__)


async def revoke_sts_token(access_token: str) -> Dict[str, Any]:
    """
    Revoke an OAuth-STS token in Okta.

    This clears Okta's cache and forces fresh consent check on next request.

    Args:
        access_token: The OAuth-STS GitHub access token to revoke

    Returns:
        Dict with success status
    """
    config = get_agent_config()
    jwt_builder = JWTBuilderFactory.get_builder()

    if not config.agent_id or not jwt_builder:
        logger.warning("[Revoke] Not configured")
        return {"success": False, "error": "Not configured"}

    try:
        # Build client assertion for revoke request
        client_assertion = jwt_builder.build_client_assertion(
            principal_id=config.agent_id,
            audience=config.token_endpoint
        )

        # Revoke endpoint
        revoke_endpoint = f"{config.okta_domain}/oauth2/v1/revoke"

        payload = {
            "token": access_token,
            "token_type_hint": "access_token",
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion,
        }

        logger.info(f"[Revoke] Revoking token at: {revoke_endpoint}")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                revoke_endpoint,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30.0
            )

        if response.status_code == 200:
            logger.info("[Revoke] Token revoked successfully")
            return {"success": True}
        else:
            logger.warning(f"[Revoke] Revoke failed: {response.status_code} - {response.text}")
            return {
                "success": False,
                "error": f"Revoke returned {response.status_code}",
                "status_code": response.status_code
            }

    except Exception as e:
        logger.error(f"[Revoke] Error: {e}")
        return {"success": False, "error": str(e)}

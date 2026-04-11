"""
Debug endpoint to verify environment variables on deployed environment.
REMOVE THIS FILE AFTER DEBUGGING!
"""

import os
from fastapi import APIRouter

router = APIRouter()


@router.get("/debug/env")
async def debug_env():
    """
    Debug endpoint to check environment variables.
    Returns masked values for security.
    """
    def mask_secret(value: str) -> str:
        """Mask secret values, showing only first/last few chars."""
        if not value or len(value) < 10:
            return "NOT_SET" if not value else "***"
        return f"{value[:8]}...{value[-4:]}"

    return {
        "okta_domain": os.getenv("OKTA_DOMAIN", "NOT_SET"),
        "okta_ai_agent_id": os.getenv("OKTA_AI_AGENT_ID", "NOT_SET"),
        "okta_ai_agent_private_key_set": bool(os.getenv("OKTA_AI_AGENT_PRIVATE_KEY")),
        "okta_ai_agent_private_key_length": len(os.getenv("OKTA_AI_AGENT_PRIVATE_KEY", "")),
        "okta_github_resource_indicator": os.getenv("OKTA_GITHUB_RESOURCE_INDICATOR", "NOT_SET"),
        "litellm_api_key": mask_secret(os.getenv("LITELLM_API_KEY", "")),
        "litellm_base_url": os.getenv("LITELLM_BASE_URL", "NOT_SET"),
        "litellm_model": os.getenv("LITELLM_MODEL", "NOT_SET"),
        "github_org": os.getenv("GITHUB_ORG", "NOT_SET"),
        "cors_origins": os.getenv("CORS_ORIGINS", "NOT_SET"),
        "backend_port": os.getenv("BACKEND_PORT", "NOT_SET"),
        "python_version": os.getenv("PYTHON_VERSION", "NOT_SET"),
    }

"""
Agent Configuration for DevOps Agent

Manages the Okta AI Agent configuration for OAuth-STS token exchange.
Supports both GitHub and Jira integrations.

Environment Variables:
- OKTA_DOMAIN: Okta org domain
- OKTA_AI_AGENT_ID: AI Agent entity ID (wlp...)
- OKTA_AI_AGENT_PRIVATE_KEY: Private JWK for signing assertions
- OKTA_GITHUB_RESOURCE_INDICATOR: Resource indicator for GitHub Managed Connection
- OKTA_JIRA_RESOURCE_INDICATOR: Resource indicator for Jira Managed Connection
- JIRA_CLOUD_URL: Jira Cloud URL (e.g., https://yourcompany.atlassian.net)
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AgentConfig:
    """Configuration for the DevOps AI Agent."""
    name: str
    agent_id: str
    private_key: Optional[Dict[str, Any]]
    okta_domain: str
    token_endpoint: str
    # GitHub config
    resource_indicator: str  # GitHub resource indicator (kept for backward compatibility)
    github_resource_indicator: str
    github_org: str
    github_default_repo: str
    # Jira config
    jira_resource_indicator: str
    jira_cloud_url: str
    jira_cloud_id: str
    jira_default_project: str


def _parse_private_key(key_str: str) -> Optional[Dict[str, Any]]:
    """Parse private key from environment variable."""
    if not key_str:
        return None
    try:
        return json.loads(key_str)
    except json.JSONDecodeError:
        logger.error("Failed to parse private key JSON")
        return None


def get_agent_config() -> AgentConfig:
    """
    Get the DevOps Agent configuration from environment.

    Returns:
        AgentConfig with all settings
    """
    okta_domain = os.getenv("OKTA_DOMAIN", "").strip()
    if okta_domain and not okta_domain.startswith("http"):
        okta_domain = f"https://{okta_domain}"

    github_resource = os.getenv("OKTA_GITHUB_RESOURCE_INDICATOR", "")
    jira_url = os.getenv("JIRA_CLOUD_URL", "").strip()
    if jira_url and not jira_url.startswith("http"):
        jira_url = f"https://{jira_url}"

    return AgentConfig(
        name="DevOps Agent",
        agent_id=os.getenv("OKTA_AI_AGENT_ID", ""),
        private_key=_parse_private_key(
            os.getenv("OKTA_AI_AGENT_PRIVATE_KEY", "")
        ),
        okta_domain=okta_domain,
        token_endpoint=f"{okta_domain}/oauth2/v1/token",
        # GitHub config
        resource_indicator=github_resource,  # backward compatibility
        github_resource_indicator=github_resource,
        github_org=os.getenv("GITHUB_ORG", ""),
        github_default_repo=os.getenv("GITHUB_DEFAULT_REPO", ""),
        # Jira config
        jira_resource_indicator=os.getenv("OKTA_JIRA_RESOURCE_INDICATOR", ""),
        jira_cloud_url=jira_url,
        jira_cloud_id=os.getenv("JIRA_CLOUD_ID", ""),
        jira_default_project=os.getenv("JIRA_DEFAULT_PROJECT", ""),
    )


def is_configured() -> bool:
    """Check if the agent is properly configured for OAuth-STS."""
    config = get_agent_config()
    required = [
        config.agent_id,
        config.private_key,
        config.okta_domain,
        config.resource_indicator,
    ]
    return all(required)


def get_demo_config() -> Dict[str, Any]:
    """Get demo mode configuration when real credentials aren't available."""
    return {
        "name": "DevOps Agent (Demo)",
        "description": "GitHub integration via Okta Brokered Consent",
        "capabilities": [
            "List repositories",
            "List pull requests",
            "List issues",
            "Comment on PRs/issues",
            "Close issues",
        ],
        "demo_mode": True,
    }

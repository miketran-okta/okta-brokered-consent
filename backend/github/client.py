"""
GitHub API Client

Low-level client for GitHub API calls using tokens from OAuth-STS exchange.
All methods accept a token parameter to use the user's exchanged GitHub token.
"""

import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
GITHUB_API_VERSION = "2022-11-28"


class GitHubClient:
    """
    GitHub API client using OAuth-STS exchanged tokens.

    All methods require a GitHub access token obtained via Okta Brokered Consent.
    """

    def __init__(self, token: str):
        """
        Initialize with a GitHub access token.

        Args:
            token: GitHub access token from OAuth-STS exchange
        """
        self._token = token
        self._headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make a GitHub API request.

        Returns:
            Dict with 'success', 'data', 'status_code', and optional 'error'
        """
        url = f"{GITHUB_API_BASE}{endpoint}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._headers,
                    json=json_data,
                    params=params,
                    timeout=30.0
                )

            if response.status_code >= 200 and response.status_code < 300:
                return {
                    "success": True,
                    "data": response.json() if response.text else {},
                    "status_code": response.status_code,
                }
            else:
                error_data = response.json() if response.text else {}
                return {
                    "success": False,
                    "data": None,
                    "status_code": response.status_code,
                    "error": error_data.get("message", f"HTTP {response.status_code}"),
                }

        except httpx.TimeoutException:
            return {
                "success": False,
                "data": None,
                "error": "Request timeout",
            }
        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return {
                "success": False,
                "data": None,
                "error": str(e),
            }

    # Repository operations
    async def list_user_repos(
        self,
        per_page: int = 30,
        sort: str = "updated"
    ) -> Dict[str, Any]:
        """List repositories for the authenticated user."""
        return await self._request(
            "GET",
            "/user/repos",
            params={"per_page": per_page, "sort": sort}
        )

    async def get_repo(self, owner: str, repo: str) -> Dict[str, Any]:
        """Get a specific repository."""
        return await self._request("GET", f"/repos/{owner}/{repo}")

    # Pull Request operations
    async def list_pull_requests(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        per_page: int = 30
    ) -> Dict[str, Any]:
        """List pull requests for a repository."""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/pulls",
            params={"state": state, "per_page": per_page}
        )

    async def get_pull_request(
        self,
        owner: str,
        repo: str,
        pr_number: int
    ) -> Dict[str, Any]:
        """Get a specific pull request."""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/pulls/{pr_number}"
        )

    # Issue operations
    async def list_issues(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        per_page: int = 30
    ) -> Dict[str, Any]:
        """List issues for a repository."""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/issues",
            params={"state": state, "per_page": per_page}
        )

    async def get_issue(
        self,
        owner: str,
        repo: str,
        issue_number: int
    ) -> Dict[str, Any]:
        """Get a specific issue."""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/issues/{issue_number}"
        )

    # Comment operations (works for both PRs and Issues)
    async def create_comment(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        body: str
    ) -> Dict[str, Any]:
        """
        Create a comment on an issue or PR.

        Note: GitHub's API uses /issues/{number}/comments for both issues and PRs.
        """
        return await self._request(
            "POST",
            f"/repos/{owner}/{repo}/issues/{issue_number}/comments",
            json_data={"body": body}
        )

    async def list_comments(
        self,
        owner: str,
        repo: str,
        issue_number: int,
        per_page: int = 30
    ) -> Dict[str, Any]:
        """List comments on an issue or PR."""
        return await self._request(
            "GET",
            f"/repos/{owner}/{repo}/issues/{issue_number}/comments",
            params={"per_page": per_page}
        )

    # Issue state operations
    async def close_issue(
        self,
        owner: str,
        repo: str,
        issue_number: int
    ) -> Dict[str, Any]:
        """Close an issue."""
        return await self._request(
            "PATCH",
            f"/repos/{owner}/{repo}/issues/{issue_number}",
            json_data={"state": "closed"}
        )

    async def reopen_issue(
        self,
        owner: str,
        repo: str,
        issue_number: int
    ) -> Dict[str, Any]:
        """Reopen an issue."""
        return await self._request(
            "PATCH",
            f"/repos/{owner}/{repo}/issues/{issue_number}",
            json_data={"state": "open"}
        )

    # User info
    async def get_authenticated_user(self) -> Dict[str, Any]:
        """Get the authenticated user's profile."""
        return await self._request("GET", "/user")

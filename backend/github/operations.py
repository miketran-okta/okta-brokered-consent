"""
GitHub Operations

High-level GitHub operations for the LangGraph orchestrator.
Wraps the low-level GitHubClient with result formatting for the UI.
Detects revoked tokens (401/403) and flags for re-authorization.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from .client import GitHubClient

logger = logging.getLogger(__name__)


def _check_token_revoked(result: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
    """Check if GitHub returned 401/403 indicating revoked token."""
    if not result["success"] and result.get("status_code") in [401, 403]:
        logger.warning(f"[{operation}] Token revoked - GitHub returned {result.get('status_code')}")
        return {
            "success": False,
            "operation": operation,
            "error": result.get("error", "Bad credentials - token may be revoked"),
            "token_revoked": True,
            "status_code": result.get("status_code"),
        }
    return None


class GitHubOperations:
    """
    High-level GitHub operations for the DevOps Agent.

    Provides formatted results suitable for LLM responses and UI display.
    """

    def __init__(self, token: str, default_org: str = "", default_repo: str = ""):
        """
        Initialize with GitHub token and defaults.

        Args:
            token: GitHub access token from OAuth-STS
            default_org: Default GitHub organization
            default_repo: Default repository name
        """
        self._client = GitHubClient(token)
        self._default_org = default_org
        self._default_repo = default_repo

    def _format_repo(self, repo: Dict) -> Dict[str, Any]:
        """Format a repository for display."""
        return {
            "name": repo.get("name"),
            "full_name": repo.get("full_name"),
            "description": repo.get("description"),
            "html_url": repo.get("html_url"),
            "language": repo.get("language"),
            "visibility": repo.get("visibility", "private"),
            "default_branch": repo.get("default_branch"),
            "updated_at": repo.get("updated_at"),
            "stargazers_count": repo.get("stargazers_count", 0),
            "forks_count": repo.get("forks_count", 0),
            "open_issues_count": repo.get("open_issues_count", 0),
        }

    def _format_pr(self, pr: Dict) -> Dict[str, Any]:
        """Format a pull request for display."""
        return {
            "number": pr.get("number"),
            "title": pr.get("title"),
            "state": pr.get("state"),
            "html_url": pr.get("html_url"),
            "user": pr.get("user", {}).get("login"),
            "created_at": pr.get("created_at"),
            "updated_at": pr.get("updated_at"),
            "head_branch": pr.get("head", {}).get("ref"),
            "base_branch": pr.get("base", {}).get("ref"),
            "draft": pr.get("draft", False),
            "mergeable": pr.get("mergeable"),
        }

    def _format_issue(self, issue: Dict) -> Dict[str, Any]:
        """Format an issue for display."""
        # Skip if it's a PR (issues endpoint returns PRs too)
        if issue.get("pull_request"):
            return None

        return {
            "number": issue.get("number"),
            "title": issue.get("title"),
            "state": issue.get("state"),
            "html_url": issue.get("html_url"),
            "user": issue.get("user", {}).get("login"),
            "created_at": issue.get("created_at"),
            "updated_at": issue.get("updated_at"),
            "labels": [l.get("name") for l in issue.get("labels", [])],
            "comments": issue.get("comments", 0),
        }

    async def list_repos(self, limit: int = 10) -> Dict[str, Any]:
        """List user's repositories."""
        result = await self._client.list_user_repos(per_page=limit)

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "list_repos")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "list_repos",
                "error": result.get("error"),
            }

        repos = [self._format_repo(r) for r in result["data"]]

        return {
            "success": True,
            "operation": "list_repos",
            "data": {
                "repositories": repos,
                "count": len(repos),
            },
            "summary": f"Found {len(repos)} repositories",
        }

    async def list_pull_requests(
        self,
        repo: Optional[str] = None,
        owner: Optional[str] = None,
        state: str = "open"
    ) -> Dict[str, Any]:
        """List pull requests for a repository."""
        repo = repo or self._default_repo
        owner = owner or self._default_org

        if not repo or not owner:
            return {
                "success": False,
                "operation": "list_prs",
                "error": "Repository and owner are required",
            }

        result = await self._client.list_pull_requests(owner, repo, state=state)

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "list_prs")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "list_prs",
                "error": result.get("error"),
            }

        prs = [self._format_pr(pr) for pr in result["data"]]

        return {
            "success": True,
            "operation": "list_prs",
            "data": {
                "pull_requests": prs,
                "count": len(prs),
                "repository": f"{owner}/{repo}",
                "state_filter": state,
            },
            "summary": f"Found {len(prs)} {state} pull requests in {owner}/{repo}",
        }

    async def list_issues(
        self,
        repo: Optional[str] = None,
        owner: Optional[str] = None,
        state: str = "open"
    ) -> Dict[str, Any]:
        """List issues for a repository."""
        repo = repo or self._default_repo
        owner = owner or self._default_org

        if not repo or not owner:
            return {
                "success": False,
                "operation": "list_issues",
                "error": "Repository and owner are required",
            }

        result = await self._client.list_issues(owner, repo, state=state)

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "list_issues")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "list_issues",
                "error": result.get("error"),
            }

        # Filter out PRs (GitHub API returns PRs as issues too)
        issues = [self._format_issue(i) for i in result["data"]]
        issues = [i for i in issues if i is not None]

        return {
            "success": True,
            "operation": "list_issues",
            "data": {
                "issues": issues,
                "count": len(issues),
                "repository": f"{owner}/{repo}",
                "state_filter": state,
            },
            "summary": f"Found {len(issues)} {state} issues in {owner}/{repo}",
        }

    async def comment_on_issue(
        self,
        issue_number: int,
        body: str,
        repo: Optional[str] = None,
        owner: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a comment to an issue or PR."""
        repo = repo or self._default_repo
        owner = owner or self._default_org

        if not repo or not owner:
            return {
                "success": False,
                "operation": "comment",
                "error": "Repository and owner are required",
            }

        result = await self._client.create_comment(owner, repo, issue_number, body)

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "comment")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "comment",
                "error": result.get("error"),
            }

        return {
            "success": True,
            "operation": "comment",
            "data": {
                "comment_url": result["data"].get("html_url"),
                "issue_number": issue_number,
                "repository": f"{owner}/{repo}",
            },
            "summary": f"Added comment to #{issue_number} in {owner}/{repo}",
        }

    async def comment_on_pr(
        self,
        pr_number: int,
        body: str,
        repo: Optional[str] = None,
        owner: Optional[str] = None
    ) -> Dict[str, Any]:
        """Add a comment to a pull request."""
        return await self.comment_on_issue(pr_number, body, repo, owner)

    async def close_issue(
        self,
        issue_number: int,
        repo: Optional[str] = None,
        owner: Optional[str] = None
    ) -> Dict[str, Any]:
        """Close an issue."""
        repo = repo or self._default_repo
        owner = owner or self._default_org

        if not repo or not owner:
            return {
                "success": False,
                "operation": "close_issue",
                "error": "Repository and owner are required",
            }

        result = await self._client.close_issue(owner, repo, issue_number)

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "close_issue")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "close_issue",
                "error": result.get("error"),
            }

        return {
            "success": True,
            "operation": "close_issue",
            "data": {
                "issue_number": issue_number,
                "repository": f"{owner}/{repo}",
                "new_state": "closed",
            },
            "summary": f"Closed issue #{issue_number} in {owner}/{repo}",
        }

    async def get_authenticated_user(self) -> Dict[str, Any]:
        """Get the authenticated GitHub user info."""
        result = await self._client.get_authenticated_user()

        # Check for revoked token
        revoked_check = _check_token_revoked(result, "get_user")
        if revoked_check:
            return revoked_check

        if not result["success"]:
            return {
                "success": False,
                "operation": "get_user",
                "error": result.get("error"),
            }

        user = result["data"]
        return {
            "success": True,
            "operation": "get_user",
            "data": {
                "login": user.get("login"),
                "name": user.get("name"),
                "email": user.get("email"),
                "avatar_url": user.get("avatar_url"),
            },
        }


# Demo mode operations
def get_demo_operations() -> Dict[str, Any]:
    """Return demo data when GitHub token is not available."""
    return {
        "repositories": [
            {
                "name": "Okta-STS-Test",
                "full_name": "oktaforai-okta/Okta-STS-Test",
                "description": "Test repository for OAuth-STS demo",
                "language": "TypeScript",
                "visibility": "private",
                "updated_at": datetime.now().isoformat(),
            },
            {
                "name": "devops-agent",
                "full_name": "oktaforai-okta/devops-agent",
                "description": "DevOps Agent demo application",
                "language": "Python",
                "visibility": "private",
                "updated_at": datetime.now().isoformat(),
            },
        ],
        "pull_requests": [
            {
                "number": 1,
                "title": "Add OAuth-STS integration",
                "state": "open",
                "user": "demo-user",
                "head_branch": "feature/oauth-sts",
                "base_branch": "main",
            },
        ],
        "issues": [
            {
                "number": 1,
                "title": "Implement token exchange",
                "state": "open",
                "user": "demo-user",
                "labels": ["enhancement"],
            },
        ],
    }

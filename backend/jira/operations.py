"""
Jira High-Level Operations

Business logic layer for Jira operations.
Handles data formatting, error detection, and token revocation checks.
"""

import logging
from typing import Dict, Any, Optional, List

from .client import JiraClient

logger = logging.getLogger(__name__)


def _check_token_revoked(result: Dict[str, Any], operation: str) -> Optional[Dict[str, Any]]:
    """Check if result indicates a revoked token."""
    if not result.get("success") and result.get("status_code") in [401, 403]:
        logger.warning(f"[Jira] Token appears revoked during {operation}")
        return {
            "success": False,
            "operation": operation,
            "data": None,
            "summary": "Jira access token was revoked. Please re-authorize.",
            "token_revoked": True,
            "error": result.get("error", "Unauthorized"),
        }
    return None


class JiraOperations:
    """High-level Jira operations with formatting and error handling."""

    def __init__(self, token: str, jira_url: str, cloud_id: str = "", default_project: str = ""):
        """
        Initialize Jira operations.

        Args:
            token: OAuth access token for Jira
            jira_url: Jira Cloud URL
            cloud_id: Jira Cloud ID for API calls
            default_project: Default project key for operations
        """
        self._client = JiraClient(token, jira_url, cloud_id)
        self._default_project = default_project
        self._jira_url = jira_url.rstrip('/')

    def _format_project(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Format project data for UI."""
        return {
            "key": project.get("key", ""),
            "name": project.get("name", ""),
            "project_type": project.get("projectTypeKey", ""),
            "style": project.get("style", ""),
            "lead": project.get("lead", {}).get("displayName", ""),
            "url": f"{self._jira_url}/browse/{project.get('key', '')}",
        }

    def _format_issue(self, issue: Dict[str, Any]) -> Dict[str, Any]:
        """Format issue data for UI."""
        fields = issue.get("fields", {})
        return {
            "key": issue.get("key", ""),
            "summary": fields.get("summary", ""),
            "status": fields.get("status", {}).get("name", ""),
            "status_category": fields.get("status", {}).get("statusCategory", {}).get("name", ""),
            "priority": fields.get("priority", {}).get("name", "") if fields.get("priority") else "None",
            "issue_type": fields.get("issuetype", {}).get("name", ""),
            "assignee": fields.get("assignee", {}).get("displayName", "Unassigned") if fields.get("assignee") else "Unassigned",
            "reporter": fields.get("reporter", {}).get("displayName", "") if fields.get("reporter") else "",
            "created": fields.get("created", ""),
            "updated": fields.get("updated", ""),
            "project": fields.get("project", {}).get("key", ""),
            "url": f"{self._jira_url}/browse/{issue.get('key', '')}",
        }

    def _format_comment(self, comment: Dict[str, Any]) -> Dict[str, Any]:
        """Format comment data for UI."""
        # Extract text from ADF format
        body = comment.get("body", {})
        text = ""
        if isinstance(body, dict) and body.get("content"):
            for content in body.get("content", []):
                if content.get("type") == "paragraph":
                    for text_content in content.get("content", []):
                        if text_content.get("type") == "text":
                            text += text_content.get("text", "")

        return {
            "id": comment.get("id", ""),
            "author": comment.get("author", {}).get("displayName", ""),
            "body": text or str(body),
            "created": comment.get("created", ""),
            "updated": comment.get("updated", ""),
        }

    # --- Project Operations ---

    async def list_projects(self, limit: int = 50) -> Dict[str, Any]:
        """List all accessible projects."""
        result = await self._client.list_projects(max_results=limit)

        revoked_check = _check_token_revoked(result, "list_projects")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "list_projects",
                "data": None,
                "summary": f"Failed to list projects: {result.get('error')}",
                "token_revoked": False,
            }

        projects_data = result.get("data", {})
        values = projects_data.get("values", [])
        projects = [self._format_project(p) for p in values]

        return {
            "success": True,
            "operation": "list_projects",
            "data": {"projects": projects, "count": len(projects)},
            "summary": f"Found {len(projects)} Jira projects",
            "token_revoked": False,
        }

    # --- Issue Operations ---

    async def list_issues(
        self,
        project: Optional[str] = None,
        assignee: Optional[str] = None,
        status: Optional[str] = None,
        jql: Optional[str] = None,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """List issues with optional filters."""
        # Build JQL query
        if jql:
            query = jql
        else:
            conditions = []
            # Only add project if explicitly specified (not default)
            if project:
                # Quote project name if it contains spaces or special characters
                if ' ' in project or '-' in project:
                    conditions.append(f'project = "{project}"')
                else:
                    conditions.append(f"project = {project}")
            if assignee:
                if assignee.lower() == "me" or assignee.lower() == "currentuser()":
                    conditions.append("assignee = currentUser()")
                else:
                    conditions.append(f"assignee = '{assignee}'")
            if status:
                # For "open" issues, use status category instead
                if status.lower() in ['open', 'opened', 'active']:
                    conditions.append("statusCategory != Done")
                else:
                    conditions.append(f"status = '{status}'")

            query = " AND ".join(conditions) if conditions else "assignee = currentUser() ORDER BY created DESC"

        if "ORDER BY" not in query.upper():
            query += " ORDER BY updated DESC"

        logger.info(f"[Jira Operations] Searching issues with JQL: {query}")
        result = await self._client.search_issues(query, max_results=limit)
        logger.info(f"[Jira Operations] Search result: success={result.get('success')}, status={result.get('status_code')}, error={result.get('error')}")

        revoked_check = _check_token_revoked(result, "list_issues")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "list_issues",
                "data": None,
                "summary": f"Failed to search issues: {result.get('error')}",
                "token_revoked": False,
            }

        issues_data = result.get("data", {})
        issues = [self._format_issue(i) for i in issues_data.get("issues", [])]

        return {
            "success": True,
            "operation": "list_issues",
            "data": {"issues": issues, "count": len(issues), "total": issues_data.get("total", 0)},
            "summary": f"Found {len(issues)} issues (total: {issues_data.get('total', 0)})",
            "token_revoked": False,
        }

    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        """Get details of a specific issue."""
        result = await self._client.get_issue(issue_key)

        revoked_check = _check_token_revoked(result, "get_issue")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "get_issue",
                "data": None,
                "summary": f"Failed to get issue {issue_key}: {result.get('error')}",
                "token_revoked": False,
            }

        issue = self._format_issue(result.get("data", {}))

        return {
            "success": True,
            "operation": "get_issue",
            "data": {"issue": issue},
            "summary": f"Retrieved issue {issue_key}",
            "token_revoked": False,
        }

    async def create_issue(
        self,
        project: str,
        summary: str,
        issue_type: str = "Task",
        description: Optional[str] = None,
        priority: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new issue."""
        project_key = project or self._default_project
        if not project_key:
            return {
                "success": False,
                "operation": "create_issue",
                "data": None,
                "summary": "Project key is required to create an issue",
                "token_revoked": False,
            }

        result = await self._client.create_issue(
            project_key=project_key,
            summary=summary,
            issue_type=issue_type,
            description=description,
            priority=priority,
        )

        revoked_check = _check_token_revoked(result, "create_issue")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "create_issue",
                "data": None,
                "summary": f"Failed to create issue: {result.get('error')}",
                "token_revoked": False,
            }

        issue_data = result.get("data", {})
        issue_key = issue_data.get("key", "")

        return {
            "success": True,
            "operation": "create_issue",
            "data": {
                "key": issue_key,
                "id": issue_data.get("id", ""),
                "url": f"{self._jira_url}/browse/{issue_key}",
            },
            "summary": f"Created issue {issue_key}",
            "token_revoked": False,
        }

    # --- Comment Operations ---

    async def add_comment(
        self,
        issue_key: str,
        body: str,
    ) -> Dict[str, Any]:
        """Add a comment to an issue."""
        result = await self._client.add_comment(issue_key, body)

        revoked_check = _check_token_revoked(result, "add_comment")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "add_comment",
                "data": None,
                "summary": f"Failed to add comment: {result.get('error')}",
                "token_revoked": False,
            }

        comment_data = result.get("data", {})

        return {
            "success": True,
            "operation": "add_comment",
            "data": {
                "id": comment_data.get("id", ""),
                "issue_key": issue_key,
            },
            "summary": f"Added comment to {issue_key}",
            "token_revoked": False,
        }

    # --- Transition Operations ---

    async def transition_issue(
        self,
        issue_key: str,
        target_status: str,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transition an issue to a new status."""
        # First, get available transitions
        transitions_result = await self._client.get_transitions(issue_key)

        revoked_check = _check_token_revoked(transitions_result, "transition_issue")
        if revoked_check:
            return revoked_check

        if not transitions_result.get("success"):
            return {
                "success": False,
                "operation": "transition_issue",
                "data": None,
                "summary": f"Failed to get transitions: {transitions_result.get('error')}",
                "token_revoked": False,
            }

        # Find the matching transition
        transitions = transitions_result.get("data", {}).get("transitions", [])
        target_transition = None
        available_statuses = []

        for t in transitions:
            status_name = t.get("to", {}).get("name", "") or t.get("name", "")
            available_statuses.append(status_name)
            if status_name.lower() == target_status.lower():
                target_transition = t
                break

        if not target_transition:
            return {
                "success": False,
                "operation": "transition_issue",
                "data": {"available_statuses": available_statuses},
                "summary": f"Cannot transition to '{target_status}'. Available: {', '.join(available_statuses)}",
                "token_revoked": False,
            }

        # Perform the transition
        result = await self._client.transition_issue(
            issue_key,
            target_transition["id"],
            comment=comment,
        )

        if not result.get("success"):
            return {
                "success": False,
                "operation": "transition_issue",
                "data": None,
                "summary": f"Failed to transition issue: {result.get('error')}",
                "token_revoked": False,
            }

        return {
            "success": True,
            "operation": "transition_issue",
            "data": {
                "issue_key": issue_key,
                "new_status": target_status,
            },
            "summary": f"Moved {issue_key} to '{target_status}'",
            "token_revoked": False,
        }

    # --- User Operations ---

    async def get_myself(self) -> Dict[str, Any]:
        """Get current authenticated user info."""
        result = await self._client.get_myself()

        revoked_check = _check_token_revoked(result, "get_myself")
        if revoked_check:
            return revoked_check

        if not result.get("success"):
            return {
                "success": False,
                "operation": "get_myself",
                "data": None,
                "summary": f"Failed to get user info: {result.get('error')}",
                "token_revoked": False,
            }

        user_data = result.get("data", {})

        return {
            "success": True,
            "operation": "get_myself",
            "data": {
                "account_id": user_data.get("accountId", ""),
                "display_name": user_data.get("displayName", ""),
                "email": user_data.get("emailAddress", ""),
                "active": user_data.get("active", False),
            },
            "summary": f"Authenticated as {user_data.get('displayName', 'Unknown')}",
            "token_revoked": False,
        }

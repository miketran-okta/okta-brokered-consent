"""
Jira REST API Client

Low-level client for Atlassian Jira Cloud REST API.
All methods return structured responses with success/error status.
"""

import logging
import httpx
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class JiraClient:
    """Low-level Jira REST API client."""

    def __init__(self, token: str, jira_url: str, cloud_id: str = ""):
        """
        Initialize Jira client.

        Args:
            token: OAuth access token for Jira
            jira_url: Jira Cloud URL (e.g., https://yourcompany.atlassian.net)
            cloud_id: Jira Cloud ID for API calls (required for OAuth)
        """
        self._token = token
        self._jira_url = jira_url.rstrip('/')
        self._cloud_id = cloud_id

        # Use Cloud ID API format if cloud_id is provided
        if cloud_id:
            self._base_url = f"https://api.atlassian.com/ex/jira/{cloud_id}"
        else:
            self._base_url = jira_url.rstrip('/')

        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request to Jira API."""
        url = f"{self._base_url}/rest/api/3{endpoint}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._headers,
                    params=params,
                    json=json_data,
                    timeout=30.0,
                )

                if response.status_code in [200, 201, 204]:
                    data = response.json() if response.content else {}
                    logger.info(f"[Jira API] {method} {endpoint} - Success: {response.status_code}")
                    return {
                        "success": True,
                        "data": data,
                        "status_code": response.status_code,
                    }
                else:
                    logger.error(f"[Jira API] {method} {endpoint} - Failed: {response.status_code}")
                    logger.error(f"[Jira API] Response body: {response.text[:500]}")
                    error_msg = response.text
                    try:
                        error_data = response.json()
                        if "errorMessages" in error_data:
                            error_msg = ", ".join(error_data["errorMessages"])
                        elif "message" in error_data:
                            error_msg = error_data["message"]
                    except Exception:
                        pass

                    logger.warning(f"[Jira API] {method} {endpoint} failed: {response.status_code} - {error_msg}")
                    return {
                        "success": False,
                        "error": error_msg,
                        "status_code": response.status_code,
                        "data": None,
                    }

        except httpx.TimeoutException:
            logger.error(f"[Jira API] Timeout: {method} {endpoint}")
            return {
                "success": False,
                "error": "Request timed out",
                "status_code": 408,
                "data": None,
            }
        except Exception as e:
            logger.error(f"[Jira API] Error: {method} {endpoint} - {e}")
            return {
                "success": False,
                "error": str(e),
                "status_code": 500,
                "data": None,
            }

    # --- Project Operations ---

    async def list_projects(self, max_results: int = 50) -> Dict[str, Any]:
        """List all accessible Jira projects."""
        return await self._request(
            "GET",
            "/project/search",
            params={"maxResults": max_results, "expand": "description,lead"},
        )

    async def get_project(self, project_key: str) -> Dict[str, Any]:
        """Get a specific project by key."""
        return await self._request("GET", f"/project/{project_key}")

    # --- Issue Operations ---

    async def search_issues(
        self,
        jql: str,
        max_results: int = 50,
        fields: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Search issues using JQL (using new /search/jql endpoint)."""
        default_fields = [
            "summary", "status", "priority", "assignee", "reporter",
            "created", "updated", "issuetype", "project", "description"
        ]
        # Use the new /search/jql GET endpoint (POST /search is deprecated)
        fields_str = ",".join(fields or default_fields)
        return await self._request(
            "GET",
            "/search/jql",
            params={
                "jql": jql,
                "maxResults": max_results,
                "fields": fields_str,
            },
        )

    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        """Get a specific issue by key."""
        return await self._request("GET", f"/issue/{issue_key}")

    async def create_issue(
        self,
        project_key: str,
        summary: str,
        issue_type: str = "Task",
        description: Optional[str] = None,
        priority: Optional[str] = None,
        assignee_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new issue."""
        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "issuetype": {"name": issue_type},
        }

        if description:
            # Jira Cloud uses Atlassian Document Format (ADF)
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}]
                    }
                ]
            }

        if priority:
            fields["priority"] = {"name": priority}

        if assignee_id:
            fields["assignee"] = {"accountId": assignee_id}

        return await self._request("POST", "/issue", json_data={"fields": fields})

    async def update_issue(
        self,
        issue_key: str,
        fields: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update an existing issue."""
        return await self._request(
            "PUT",
            f"/issue/{issue_key}",
            json_data={"fields": fields},
        )

    # --- Comment Operations ---

    async def add_comment(
        self,
        issue_key: str,
        body: str,
    ) -> Dict[str, Any]:
        """Add a comment to an issue."""
        # Jira Cloud uses Atlassian Document Format (ADF)
        comment_body = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": body}]
                    }
                ]
            }
        }
        return await self._request(
            "POST",
            f"/issue/{issue_key}/comment",
            json_data=comment_body,
        )

    async def get_comments(
        self,
        issue_key: str,
        max_results: int = 20,
    ) -> Dict[str, Any]:
        """Get comments for an issue."""
        return await self._request(
            "GET",
            f"/issue/{issue_key}/comment",
            params={"maxResults": max_results},
        )

    # --- Transition Operations ---

    async def get_transitions(self, issue_key: str) -> Dict[str, Any]:
        """Get available transitions for an issue."""
        return await self._request("GET", f"/issue/{issue_key}/transitions")

    async def transition_issue(
        self,
        issue_key: str,
        transition_id: str,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transition an issue to a new status."""
        data: Dict[str, Any] = {
            "transition": {"id": transition_id}
        }

        if comment:
            data["update"] = {
                "comment": [
                    {
                        "add": {
                            "body": {
                                "type": "doc",
                                "version": 1,
                                "content": [
                                    {
                                        "type": "paragraph",
                                        "content": [{"type": "text", "text": comment}]
                                    }
                                ]
                            }
                        }
                    }
                ]
            }

        return await self._request(
            "POST",
            f"/issue/{issue_key}/transitions",
            json_data=data,
        )

    # --- User Operations ---

    async def get_myself(self) -> Dict[str, Any]:
        """Get current authenticated user."""
        return await self._request("GET", "/myself")

    async def search_users(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """Search for users."""
        return await self._request(
            "GET",
            "/user/search",
            params={"query": query, "maxResults": max_results},
        )

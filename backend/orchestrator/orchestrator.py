"""
LangGraph Orchestrator for DevOps Agent

Coordinates the workflow for GitHub and Jira operations via Okta Brokered Consent:
1. Router - Parse user intent, detect service (GitHub/Jira), and extract parameters
2. STS Exchange - Exchange user token for service token (handles interaction_required)
3. Execute Operation - Perform the requested GitHub or Jira operation
4. Generate Response - Create natural language response

OAuth-STS Flow (per Okta documentation):
- First request may return "interaction_required" with interaction_uri
- User must be redirected to interaction_uri to authorize at the service
- After authorization, retry the token exchange to get access_token

Workflow Visualization:
  router → sts_exchange → [execute_github | execute_jira] → generate_response
"""

import os
import logging
import json
from typing import Dict, Any, List, Optional, TypedDict, Literal
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage

from orchestrator.litellm_client import LiteLLMClient

from auth.okta_sts import get_sts_exchange, OktaSTSExchange
from auth.agent_config import get_agent_config
from github.operations import GitHubOperations, get_demo_operations
from jira.operations import JiraOperations

logger = logging.getLogger(__name__)


class WorkflowState(TypedDict):
    """State passed through the LangGraph workflow."""
    # Input
    user_message: str
    user_token: str
    user_info: Dict[str, Any]

    # Routing
    service: str  # "github" or "jira"
    intent: str  # list_repos, list_prs, list_issues, list_projects, list_jira_issues, etc.
    parameters: Dict[str, Any]  # repo, owner, number, body, project, jql, etc.

    # Token exchange
    service_token: Optional[str]  # GitHub or Jira token
    sts_result: Dict[str, Any]
    interaction_required: bool
    interaction_uri: Optional[str]

    # Operation result
    operation_result: Dict[str, Any]

    # Tracking for UI
    agent_flow: List[Dict[str, Any]]
    token_exchanges: List[Dict[str, Any]]

    # Response
    final_response: str


# Intent definitions for both services
GITHUB_INTENTS = ["list_repos", "list_prs", "list_issues", "comment", "close_issue"]
JIRA_INTENTS = ["list_projects", "list_jira_issues", "create_issue", "comment_jira", "transition_issue", "get_issue"]


class Orchestrator:
    """
    LangGraph-based orchestrator for DevOps Agent.

    Coordinates OAuth-STS token exchange and GitHub/Jira operations.
    Handles the interaction_required flow for first-time user consent.
    """

    def __init__(self, user_token: str, user_info: Dict[str, Any]):
        """
        Initialize the orchestrator.

        Args:
            user_token: User's Okta ID token (from linked application)
            user_info: User information (sub, email, name, groups)
        """
        self.user_token = user_token
        self.user_info = user_info
        self.config = get_agent_config()

        # LLM for routing and response generation (via LiteLLM proxy)
        litellm_api_key = os.getenv("LITELLM_API_KEY")
        litellm_base_url = os.getenv("LITELLM_BASE_URL")
        litellm_model = os.getenv("LITELLM_MODEL", "claude-4-5-sonnet")

        if not litellm_api_key or not litellm_base_url:
            logger.error("LITELLM_API_KEY and LITELLM_BASE_URL must be set!")
            raise ValueError("LiteLLM configuration required")

        self.llm = LiteLLMClient(
            api_key=litellm_api_key,
            base_url=litellm_base_url,
            model=litellm_model,
            temperature=0  # Keep deterministic for intent parsing
        )

        # Build the workflow graph
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        workflow = StateGraph(WorkflowState)

        # Add nodes
        workflow.add_node("router", self._router_node)
        workflow.add_node("sts_exchange", self._sts_exchange_node)
        workflow.add_node("execute_github", self._execute_github_node)
        workflow.add_node("execute_jira", self._execute_jira_node)
        workflow.add_node("generate_response", self._generate_response_node)

        # Add edges
        workflow.set_entry_point("router")
        workflow.add_conditional_edges(
            "router",
            self._should_execute,
            {
                "execute": "sts_exchange",
                "help": "generate_response",
            }
        )
        workflow.add_conditional_edges(
            "sts_exchange",
            self._check_sts_result,
            {
                "github": "execute_github",
                "jira": "execute_jira",
                "interaction_required": "generate_response",
            }
        )
        workflow.add_edge("execute_github", "generate_response")
        workflow.add_edge("execute_jira", "generate_response")
        workflow.add_edge("generate_response", END)

        return workflow.compile()

    def _should_execute(self, state: WorkflowState) -> str:
        """Determine if we should execute operation or just respond."""
        if state["intent"] == "help":
            return "help"
        return "execute"

    def _check_sts_result(self, state: WorkflowState) -> str:
        """Check STS result and route to appropriate service."""
        if state.get("interaction_required"):
            return "interaction_required"
        if state["service"] == "jira":
            return "jira"
        return "github"

    async def _router_node(self, state: WorkflowState) -> WorkflowState:
        """Parse user intent, detect service, and extract parameters."""
        logger.info(f"[Router] Processing: {state['user_message'][:50]}...")

        state["agent_flow"].append({
            "step": "router",
            "action": "Analyzing request",
            "status": "processing",
        })

        # Use LLM to parse intent and detect service
        system_prompt = """You are a DevOps assistant that helps with GitHub and Jira operations.
Analyze the user's message and extract:
1. service: "github" or "jira" (detect based on keywords like repo, PR, Jira, project, ticket, etc.)
2. intent: The action to perform
3. parameters: Any relevant parameters

For GitHub, intents are: list_repos, list_prs, list_issues, comment, close_issue, help
For Jira, intents are: list_projects, list_jira_issues, create_issue, comment_jira, transition_issue, get_issue, help

Respond with JSON only:
{"service": "github|jira", "intent": "...", "parameters": {...}}

Examples:
- "Show my repos" → {"service": "github", "intent": "list_repos", "parameters": {}}
- "List PRs in my-repo" → {"service": "github", "intent": "list_prs", "parameters": {"repo": "my-repo"}}
- "List my Jira projects" → {"service": "jira", "intent": "list_projects", "parameters": {}}
- "Show issues in PROJECT" → {"service": "jira", "intent": "list_jira_issues", "parameters": {"project": "PROJECT"}}
- "Show open issues assigned to me" → {"service": "jira", "intent": "list_jira_issues", "parameters": {"assignee": "me"}}
- "Create a bug in PROJ: Login broken" → {"service": "jira", "intent": "create_issue", "parameters": {"project": "PROJ", "summary": "Login broken", "issue_type": "Bug"}}
- "Move PROJ-123 to In Progress" → {"service": "jira", "intent": "transition_issue", "parameters": {"issue_key": "PROJ-123", "status": "In Progress"}}
- "Add comment to PROJ-456: Working on it" → {"service": "jira", "intent": "comment_jira", "parameters": {"issue_key": "PROJ-456", "body": "Working on it"}}
- "Find issues with JQL: priority = High" → {"service": "jira", "intent": "list_jira_issues", "parameters": {"jql": "priority = High"}}
- "What can you do?" → {"service": "github", "intent": "help", "parameters": {}}
"""

        response = await self.llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=state["user_message"])
        ])

        try:
            content = response.content.strip()
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1]) if len(lines) > 2 else content
                content = content.strip()

            result = json.loads(content)
            state["service"] = result.get("service", "github")
            state["intent"] = result.get("intent", "help")
            state["parameters"] = result.get("parameters", {})
            logger.info(f"[Router] Service: {state['service']}, Intent: {state['intent']}")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse router response: {response.content}")
            logger.error(f"JSON parse error: {e}")
            state["service"] = "github"
            state["intent"] = "help"
            state["parameters"] = {}

        state["agent_flow"][-1]["status"] = "completed"
        state["agent_flow"][-1]["action"] = f"{state['service'].title()}: {state['intent']}"

        return state

    async def _sts_exchange_node(self, state: WorkflowState) -> WorkflowState:
        """Exchange user token for service token via OAuth-STS."""
        service = state["service"]
        logger.info(f"[STS Exchange] Starting token exchange for {service}")

        state["agent_flow"].append({
            "step": "sts_exchange",
            "action": f"Exchanging token for {service.title()} via OAuth-STS",
            "status": "processing",
        })

        # Get the appropriate resource indicator based on service
        if service == "jira":
            resource_indicator = self.config.jira_resource_indicator
            service_name = "Jira"
            agent_name = "Jira MCP"
            color = "#0052CC"  # Jira blue
            # Jira requires explicit scopes in the OAuth-STS request
            requested_scopes = ["read:jira-work", "write:jira-work", "read:jira-user"]
        else:
            resource_indicator = self.config.github_resource_indicator
            service_name = "GitHub"
            agent_name = "GitHub MCP"
            color = "#6366f1"
            requested_scopes = []  # GitHub doesn't require explicit scopes

        # Check if resource indicator is configured
        if not resource_indicator:
            logger.warning(f"[STS Exchange] No resource indicator configured for {service}")
            state["service_token"] = None
            state["sts_result"] = {
                "success": False,
                "error": f"{service_name} integration not configured. Please set OKTA_{service.upper()}_RESOURCE_INDICATOR environment variable.",
            }
            state["interaction_required"] = False
            state["interaction_uri"] = None

            state["token_exchanges"].append({
                "agent": "DevOps Agent",
                "agent_name": agent_name,
                "color": color,
                "success": False,
                "access_denied": False,
                "status": "error",
                "scopes": [],
                "requested_scopes": [],
                "error": f"{service_name} not configured",
                "demo_mode": False,
            })

            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = f"{service_name} not configured"
            return state

        # Create STS exchange with the appropriate resource indicator and scopes
        sts = OktaSTSExchange(resource_indicator=resource_indicator, scopes=requested_scopes)
        result = await sts.exchange_token(state["user_token"])

        state["sts_result"] = result
        state["interaction_required"] = result.get("interaction_required", False)
        interaction_uri = result.get("interaction_uri")

        # For Jira, append scopes to the interaction_uri if needed
        if interaction_uri and service == "jira" and requested_scopes:
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            parsed = urlparse(interaction_uri)
            params = parse_qs(parsed.query)

            # Add scope parameter if not present
            if 'scope' not in params:
                params['scope'] = [' '.join(requested_scopes)]
                new_query = urlencode(params, doseq=True)
                interaction_uri = urlunparse((
                    parsed.scheme, parsed.netloc, parsed.path,
                    parsed.params, new_query, parsed.fragment
                ))
                logger.info(f"[STS Exchange] Added scopes to Jira interaction_uri: {requested_scopes}")

        state["interaction_uri"] = interaction_uri

        if result["success"]:
            state["service_token"] = result["access_token"]

            state["token_exchanges"].append({
                "agent": "DevOps Agent",
                "agent_name": agent_name,
                "color": color,
                "success": True,
                "access_denied": False,
                "status": "granted",
                "scopes": result.get("scopes", []),  # Real scopes from JWT
                "requested_scopes": requested_scopes,  # What we asked for
                "demo_mode": result.get("demo_mode", False),
                "token_details": result.get("token_details"),  # All decoded tokens for UI
            })

            state["agent_flow"][-1]["status"] = "completed"
            state["agent_flow"][-1]["action"] = f"{service_name} token exchange successful"

        elif result.get("interaction_required"):
            state["service_token"] = None

            state["token_exchanges"].append({
                "agent": "DevOps Agent",
                "agent_name": agent_name,
                "color": color,
                "success": False,
                "access_denied": False,
                "status": "interaction_required",
                "scopes": [],
                "requested_scopes": requested_scopes,  # Show what we're requesting
                "error": "User authorization required",
                "interaction_uri": result.get("interaction_uri"),
                "demo_mode": False,
                "token_details": result.get("token_details"),  # Include ID token and client assertion
            })

            state["agent_flow"][-1]["status"] = "pending"
            state["agent_flow"][-1]["action"] = f"Awaiting user authorization at {service_name}"

        else:
            state["service_token"] = None

            state["token_exchanges"].append({
                "agent": "DevOps Agent",
                "agent_name": agent_name,
                "color": color,
                "success": False,
                "access_denied": True,
                "status": "denied",
                "scopes": [],
                "requested_scopes": [],
                "error": result.get("error"),
                "demo_mode": False,
            })

            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = result.get("error", "Token exchange failed")

        logger.info(f"[STS Exchange] Result: success={result['success']}, interaction_required={state['interaction_required']}")
        return state

    async def _execute_github_node(self, state: WorkflowState) -> WorkflowState:
        """Execute the GitHub operation."""
        logger.info(f"[Execute GitHub] Operation: {state['intent']}")

        state["agent_flow"].append({
            "step": "execute_github",
            "action": f"Executing {state['intent']}",
            "status": "processing",
        })

        if not state["service_token"]:
            error_msg = state["sts_result"].get("error", "No GitHub token available")
            state["operation_result"] = {"success": False, "error": error_msg}
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = error_msg
            return state

        if state["sts_result"].get("demo_mode"):
            demo_data = get_demo_operations()
            state["operation_result"] = {
                "success": True,
                "operation": state["intent"],
                "data": demo_data,
                "demo_mode": True,
            }
            state["agent_flow"][-1]["status"] = "completed"
            state["agent_flow"][-1]["action"] = f"Demo: {state['intent']}"
            return state

        ops = GitHubOperations(
            token=state["service_token"],
            default_org=self.config.github_org,
            default_repo=self.config.github_default_repo
        )

        params = state["parameters"]

        if state["intent"] == "list_repos":
            result = await ops.list_repos()
        elif state["intent"] == "list_prs":
            result = await ops.list_pull_requests(
                repo=params.get("repo"),
                owner=params.get("owner")
            )
        elif state["intent"] == "list_issues":
            result = await ops.list_issues(
                repo=params.get("repo"),
                owner=params.get("owner")
            )
        elif state["intent"] == "comment":
            number = params.get("number")
            body = params.get("body", "")
            if number:
                result = await ops.comment_on_issue(
                    issue_number=int(number),
                    body=body,
                    repo=params.get("repo"),
                    owner=params.get("owner")
                )
            else:
                result = {"success": False, "error": "Missing issue/PR number"}
        elif state["intent"] == "close_issue":
            number = params.get("number")
            if number:
                result = await ops.close_issue(
                    issue_number=int(number),
                    repo=params.get("repo"),
                    owner=params.get("owner")
                )
            else:
                result = {"success": False, "error": "Missing issue number"}
        else:
            result = {"success": False, "error": f"Unknown GitHub intent: {state['intent']}"}

        state["operation_result"] = result

        if result.get("token_revoked"):
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = "GitHub token revoked"
            state["interaction_required"] = True
            state["interaction_uri"] = None
        elif result["success"]:
            state["agent_flow"][-1]["status"] = "completed"
            state["agent_flow"][-1]["action"] = result.get("summary", f"Completed {state['intent']}")
        else:
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = result.get("error", "Operation failed")

        return state

    async def _execute_jira_node(self, state: WorkflowState) -> WorkflowState:
        """Execute the Jira operation."""
        logger.info(f"[Execute Jira] Operation: {state['intent']}")

        state["agent_flow"].append({
            "step": "execute_jira",
            "action": f"Executing {state['intent']}",
            "status": "processing",
        })

        if not state["service_token"]:
            error_msg = state["sts_result"].get("error", "No Jira token available")
            state["operation_result"] = {"success": False, "error": error_msg}
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = error_msg
            return state

        # Check if Jira URL is configured
        if not self.config.jira_cloud_url:
            state["operation_result"] = {
                "success": False,
                "error": "Jira Cloud URL not configured. Please set JIRA_CLOUD_URL environment variable."
            }
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = "Jira not configured"
            return state

        ops = JiraOperations(
            token=state["service_token"],
            jira_url=self.config.jira_cloud_url,
            cloud_id=self.config.jira_cloud_id,
            default_project=self.config.jira_default_project
        )

        params = state["parameters"]

        if state["intent"] == "list_projects":
            result = await ops.list_projects()

        elif state["intent"] == "list_jira_issues":
            result = await ops.list_issues(
                project=params.get("project"),
                assignee=params.get("assignee"),
                status=params.get("status"),
                jql=params.get("jql"),
            )

        elif state["intent"] == "get_issue":
            issue_key = params.get("issue_key")
            if issue_key:
                result = await ops.get_issue(issue_key)
            else:
                result = {"success": False, "error": "Missing issue key"}

        elif state["intent"] == "create_issue":
            project = params.get("project")
            summary = params.get("summary")
            if project and summary:
                result = await ops.create_issue(
                    project=project,
                    summary=summary,
                    issue_type=params.get("issue_type", "Task"),
                    description=params.get("description"),
                    priority=params.get("priority"),
                )
            else:
                result = {"success": False, "error": "Missing project or summary for issue creation"}

        elif state["intent"] == "comment_jira":
            issue_key = params.get("issue_key")
            body = params.get("body")
            if issue_key and body:
                result = await ops.add_comment(issue_key, body)
            else:
                result = {"success": False, "error": "Missing issue key or comment body"}

        elif state["intent"] == "transition_issue":
            issue_key = params.get("issue_key")
            status = params.get("status")
            if issue_key and status:
                result = await ops.transition_issue(
                    issue_key=issue_key,
                    target_status=status,
                    comment=params.get("comment"),
                )
            else:
                result = {"success": False, "error": "Missing issue key or target status"}

        else:
            result = {"success": False, "error": f"Unknown Jira intent: {state['intent']}"}

        state["operation_result"] = result

        if result.get("token_revoked"):
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = "Jira token revoked"
            state["interaction_required"] = True
            state["interaction_uri"] = None
        elif result["success"]:
            state["agent_flow"][-1]["status"] = "completed"
            state["agent_flow"][-1]["action"] = result.get("summary", f"Completed {state['intent']}")
        else:
            state["agent_flow"][-1]["status"] = "error"
            state["agent_flow"][-1]["action"] = result.get("error", "Operation failed")

        return state

    async def _generate_response_node(self, state: WorkflowState) -> WorkflowState:
        """Generate natural language response."""
        logger.info("[Response] Generating response")

        state["agent_flow"].append({
            "step": "generate_response",
            "action": "Generating response",
            "status": "processing",
        })

        service = state.get("service", "github")

        # Handle help intent
        if state["intent"] == "help":
            state["final_response"] = """I'm a DevOps Agent that can help you with **GitHub** and **Jira** operations.

**GitHub Operations:**
- List repositories: "Show my repos"
- List PRs: "List PRs in {repo}"
- List issues: "Show issues in {repo}"
- Comment: "Comment on issue #5 saying 'message'"
- Close issues: "Close issue #10"

**Jira Operations:**
- List projects: "List my Jira projects"
- List issues: "Show open issues in PROJECT" or "Show issues assigned to me"
- Search with JQL: "Find issues with JQL: priority = High"
- Create issue: "Create a bug in PROJ: Description"
- Transition: "Move PROJ-123 to In Progress"
- Comment: "Add comment to PROJ-456: Working on it"

I access services on your behalf using Okta Brokered Consent (OAuth-STS).

What would you like to do?"""
            state["agent_flow"][-1]["status"] = "completed"
            return state

        operation_result = state.get("operation_result", {})

        # Handle token revoked
        if not operation_result.get("success") and operation_result.get("token_revoked"):
            service_name = "Jira" if service == "jira" else "GitHub"
            state["final_response"] = f"""⚠️ **{service_name} Access Token Revoked**

Your {service_name} authorization has been revoked, but Okta still has a cached token.

**To re-authorize:**
1. Go to your Okta user settings
2. Find and revoke the {service_name} connection
3. Retry your request
4. Complete the authorization flow

The cached token will expire in ~8 hours if you don't revoke manually."""
            state["agent_flow"][-1]["status"] = "completed"
            return state

        # Handle interaction_required
        if state.get("interaction_required") and state.get("interaction_uri"):
            service_name = "Jira" if service == "jira" else "GitHub"
            state["final_response"] = f"""To access your {service_name} account, I need your authorization first.

**Click the "Authorize {service_name} Access" button** that will appear below this message.

This is a one-time authorization through Okta Brokered Consent. After you authorize, you can retry your request."""
            state["agent_flow"][-1]["status"] = "completed"
            return state

        # Handle other errors
        if not operation_result.get("success"):
            error = operation_result.get("error", "An error occurred")
            state["final_response"] = f"I encountered an issue: {error}"
            state["agent_flow"][-1]["status"] = "completed"
            return state

        # Success - use LLM to generate natural response
        service_name = "Jira" if service == "jira" else "GitHub"
        system_prompt = f"""You are a helpful DevOps assistant. Generate a clear, human-readable response based on the {service_name} operation result.

Formatting rules:
- Write in plain, conversational English
- For lists of items (repos, issues, PRs), use simple numbered lists like:
  1. repo-name - description
  2. another-repo - description
- Include key details like status, dates, and counts
- Keep it scannable and easy to read
- Do NOT use markdown tables or special formatting
- Do NOT use asterisks for bold or backticks for code
- Just write clean, readable text

Example good response:
"I found 3 repositories in your organization:

1. my-app (public, TypeScript) - Last updated 2 days ago
2. api-server (private, Python) - Last updated 1 week ago
3. docs (public) - Last updated 3 days ago

Would you like more details about any of these?"
"""

        context = f"""
Service: {service_name}
Operation: {state['intent']}
Result: {json.dumps(operation_result.get('data', {}), indent=2)}
Summary: {operation_result.get('summary', '')}
"""

        response = await self.llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Generate a response for this {service_name} operation:\n{context}")
        ])

        state["final_response"] = response.content
        state["agent_flow"][-1]["status"] = "completed"

        return state

    async def process(self, message: str, conversation_context: str = "") -> Dict[str, Any]:
        """
        Process a user message through the workflow.

        Args:
            message: User's message
            conversation_context: Previous conversation for context

        Returns:
            Dict with content, agent_flow, token_exchanges, and interaction_uri if needed
        """
        initial_state: WorkflowState = {
            "user_message": message,
            "user_token": self.user_token,
            "user_info": self.user_info,
            "service": "github",
            "intent": "",
            "parameters": {},
            "service_token": None,
            "sts_result": {},
            "interaction_required": False,
            "interaction_uri": None,
            "operation_result": {},
            "agent_flow": [],
            "token_exchanges": [],
            "final_response": "",
        }

        try:
            final_state = await self.graph.ainvoke(initial_state)

            result = {
                "content": final_state["final_response"],
                "agent_flow": final_state["agent_flow"],
                "token_exchanges": final_state["token_exchanges"],
                "github_data": final_state.get("operation_result", {}).get("data") if final_state.get("service") == "github" else None,
                "jira_data": final_state.get("operation_result", {}).get("data") if final_state.get("service") == "jira" else None,
            }

            if final_state.get("interaction_required") and final_state.get("interaction_uri"):
                result["interaction_required"] = True
                result["interaction_uri"] = final_state["interaction_uri"]

            return result

        except Exception as e:
            logger.error(f"Orchestrator error: {e}")
            return {
                "content": f"I encountered an error processing your request: {str(e)}",
                "agent_flow": [{"step": "error", "action": str(e), "status": "error"}],
                "token_exchanges": [],
                "github_data": None,
                "jira_data": None,
            }

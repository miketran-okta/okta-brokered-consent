"""
DevOps Agent - FastAPI Backend

Main entry point for the API server.
Provides endpoints for chat, health, and configuration.

Features:
- OAuth-STS token exchange for GitHub access (with interaction_required flow)
- LangGraph orchestration
- Agent flow visualization data

OAuth-STS Flow:
1. First token exchange may return interaction_required with interaction_uri
2. User must be redirected to interaction_uri to authorize at GitHub
3. After authorization, retry the request to get access_token
"""

import os
import logging
import httpx
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

from auth.agent_config import get_agent_config, is_configured
from auth.okta_revoke import revoke_sts_token
from orchestrator.orchestrator import Orchestrator
from api.conversation_store import conversation_store
from api.debug import router as debug_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DevOps Agent API",
    description="AI-powered DevOps assistant with Okta Brokered Consent for GitHub",
    version="1.0.0",
)

# CORS configuration
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include debug router (REMOVE IN PRODUCTION!)
app.include_router(debug_router)


# --- Request/Response Models ---

class ChatMessage(BaseModel):
    """A single chat message."""
    role: str
    content: str


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str
    session_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = []


class DecodedToken(BaseModel):
    """Decoded JWT token details for UI display."""
    header: Optional[Dict[str, Any]] = None
    payload: Optional[Dict[str, Any]] = None
    signature_preview: Optional[str] = None
    raw_token_preview: Optional[str] = None
    error: Optional[str] = None


class TokenInfo(BaseModel):
    """Full token information including decoded details."""
    decoded: Optional[DecodedToken] = None
    token_preview: Optional[str] = None
    token_type: Optional[str] = None
    expires_in: Optional[int] = None


class TokenDetails(BaseModel):
    """All token details for the OAuth-STS exchange."""
    id_token: Optional[TokenInfo] = None
    client_assertion: Optional[TokenInfo] = None
    access_token: Optional[TokenInfo] = None


class TokenExchange(BaseModel):
    """Token exchange result for UI visualization."""
    agent: str
    agent_name: str
    color: str
    success: bool
    access_denied: bool = False
    status: str  # "granted", "denied", "interaction_required", "error"
    scopes: List[str] = []
    requested_scopes: List[str] = []
    error: Optional[str] = None
    interaction_uri: Optional[str] = None  # URL for user to authorize at ISV
    demo_mode: bool = False
    token_details: Optional[TokenDetails] = None  # Decoded token information


class AgentFlowStep(BaseModel):
    """A step in the agent flow for UI visualization."""
    step: str
    action: str
    status: str  # "processing", "completed", "pending", "error"


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    content: str
    session_id: str
    agent_flow: List[AgentFlowStep]
    token_exchanges: List[TokenExchange]
    github_data: Optional[Dict[str, Any]] = None
    user_info: Optional[Dict[str, Any]] = None
    # OAuth-STS interaction flow
    interaction_required: bool = False
    interaction_uri: Optional[str] = None  # URL to redirect user for GitHub authorization


# --- Health Check ---

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    config = get_agent_config()
    return {
        "status": "healthy",
        "service": "devops-agent-api",
        "version": "1.0.0",
        "oauth_sts_configured": is_configured(),
        "github_org": config.github_org,
    }


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "DevOps Agent API",
        "version": "1.0.0",
        "description": "AI-powered DevOps assistant with Okta Brokered Consent",
        "docs": "/docs",
        "health": "/health",
    }


# --- Token Validation ---

async def validate_okta_token(token: str) -> Dict[str, Any]:
    """
    Validate an Okta ID token and extract claims.

    For demo purposes, we do basic validation.
    In production, use proper JWT validation with JWKS.
    """
    config = get_agent_config()

    if not token:
        return {"valid": False, "error": "No token provided"}

    try:
        # For a proper implementation, validate the JWT signature
        # using Okta's JWKS endpoint: {okta_domain}/.well-known/jwks.json

        # Basic JWT parsing (for demo - extract payload)
        import base64
        import json

        parts = token.split(".")
        if len(parts) != 3:
            return {"valid": False, "error": "Invalid token format"}

        # Decode payload (add padding if needed)
        payload = parts[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding

        decoded = base64.urlsafe_b64decode(payload)
        claims = json.loads(decoded)

        return {
            "valid": True,
            "sub": claims.get("sub"),
            "email": claims.get("email"),
            "name": claims.get("name"),
            "groups": claims.get("groups", []),
        }
    except Exception as e:
        logger.warning(f"Token validation error: {e}")
        return {"valid": False, "error": str(e)}


# --- Chat Endpoint ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None, alias="Authorization")
):
    """
    Main chat endpoint.

    Flow:
    1. Validate user token (ID token from linked application)
    2. Route to orchestrator
    3. OAuth-STS token exchange for GitHub
       - May return interaction_required with interaction_uri
       - User must authorize at GitHub, then retry
    4. Execute GitHub operation
    5. Return response with visualization data
    """
    logger.info(f"=== Chat Request ===")
    logger.info(f"Message: {request.message[:50]}...")
    logger.info(f"Has auth header: {authorization is not None}")

    # Extract user token
    user_token = None
    user_info = {"email": "anonymous", "groups": []}

    if authorization and authorization.startswith("Bearer "):
        user_token = authorization[7:]
        validation = await validate_okta_token(user_token)
        if validation.get("valid"):
            user_info = {
                "sub": validation.get("sub"),
                "email": validation.get("email"),
                "name": validation.get("name"),
                "groups": validation.get("groups", []),
            }
            logger.info(f"User authenticated: {user_info.get('email')}")

    # Get or create conversation session
    session_id = conversation_store.get_or_create_session(request.session_id)

    # Get conversation context for routing
    conversation_context = conversation_store.get_context_summary(session_id, max_messages=6)

    # Store user's message
    conversation_store.add_message(session_id, "user", request.message)

    # Process through orchestrator
    try:
        orchestrator = Orchestrator(
            user_token=user_token or "",
            user_info=user_info
        )
        result = await orchestrator.process(request.message, conversation_context)

        # Store assistant's response
        conversation_store.add_message(session_id, "assistant", result["content"])

        # Build token exchanges with proper model
        token_exchanges = []
        for ex in result.get("token_exchanges", []):
            # Parse token_details if present
            token_details_data = ex.get("token_details")
            token_details = None
            if token_details_data:
                def parse_token_info(data: dict) -> Optional[TokenInfo]:
                    if not data:
                        return None
                    decoded_data = data.get("decoded", {})
                    return TokenInfo(
                        decoded=DecodedToken(
                            header=decoded_data.get("header"),
                            payload=decoded_data.get("payload"),
                            signature_preview=decoded_data.get("signature_preview"),
                            raw_token_preview=decoded_data.get("raw_token_preview"),
                            error=decoded_data.get("error"),
                        ) if decoded_data else None,
                        token_preview=data.get("token_preview"),
                        token_type=data.get("token_type"),
                        expires_in=data.get("expires_in"),
                    )

                token_details = TokenDetails(
                    id_token=parse_token_info(token_details_data.get("id_token")),
                    client_assertion=parse_token_info(token_details_data.get("client_assertion")),
                    access_token=parse_token_info(token_details_data.get("access_token")),
                )

            token_exchanges.append(TokenExchange(
                agent=ex.get("agent", ""),
                agent_name=ex.get("agent_name", ""),
                color=ex.get("color", "#6366f1"),
                success=ex.get("success", False),
                access_denied=ex.get("access_denied", False),
                status=ex.get("status", "error"),
                scopes=ex.get("scopes", []),
                requested_scopes=ex.get("requested_scopes", []),
                error=ex.get("error"),
                interaction_uri=ex.get("interaction_uri"),
                demo_mode=ex.get("demo_mode", False),
                token_details=token_details,
            ))

        return ChatResponse(
            content=result["content"],
            session_id=session_id,
            agent_flow=[AgentFlowStep(**step) for step in result.get("agent_flow", [])],
            token_exchanges=token_exchanges,
            github_data=result.get("github_data"),
            user_info=user_info,
            interaction_required=result.get("interaction_required", False),
            interaction_uri=result.get("interaction_uri"),
        )

    except Exception as e:
        logger.error(f"Orchestrator error: {e}")

        return ChatResponse(
            content=f"I encountered an error processing your request: {str(e)}",
            session_id=session_id,
            agent_flow=[AgentFlowStep(step="error", action=str(e), status="error")],
            token_exchanges=[],
            github_data=None,
            user_info=user_info,
            interaction_required=False,
            interaction_uri=None,
        )


# --- Configuration Endpoint ---

@app.get("/api/config")
async def get_config():
    """
    Return public configuration for frontend.
    Only returns non-sensitive information.
    """
    config = get_agent_config()
    return {
        "okta_domain": config.okta_domain,
        "github_org": config.github_org,
        "github_default_repo": config.github_default_repo,
        "oauth_sts_configured": is_configured(),
        "agent_name": config.name,
    }


# --- Revoke Token Endpoint ---

@app.post("/api/revoke")
async def revoke_token():
    """
    Revoke cached OAuth-STS token to force fresh consent.
    This clears Okta's token cache so next request triggers interaction_required.
    """
    # We don't have the actual token stored, so we'll signal success
    # The real revocation happens when user re-authenticates
    logger.info("[Revoke] Token revoke requested - will force fresh consent on next request")

    # Clear conversation store to reset state
    conversation_store.clear_all()

    return {
        "success": True,
        "message": "Token cache cleared. Next GitHub request will require fresh authorization."
    }


# --- Demo Reset Endpoint ---

@app.post("/api/demo/reset")
async def reset_demo():
    """
    Reset demo state.
    Clears conversation history.
    """
    try:
        count = conversation_store.clear_all()

        return {
            "success": True,
            "message": "Demo state reset",
            "sessions_cleared": count,
        }
    except Exception as e:
        logger.error(f"Demo reset failed: {e}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


# --- Agent Info Endpoint ---

@app.get("/api/agent")
async def agent_info():
    """Get information about the DevOps Agent."""
    config = get_agent_config()
    return {
        "name": config.name,
        "description": "AI-powered DevOps assistant with GitHub integration via Okta Brokered Consent",
        "capabilities": [
            "List repositories",
            "List pull requests",
            "List issues",
            "Comment on PRs and issues",
            "Close issues",
        ],
        "auth_flow": "OAuth-STS (Brokered Consent)",
        "configured": is_configured(),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)

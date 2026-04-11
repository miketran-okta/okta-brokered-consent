"""
LiteLLM client wrapper that maintains LangChain interface compatibility.
Allows switching from langchain-anthropic to OpenAI client with minimal changes.
"""
import logging
from typing import List
from openai import AsyncOpenAI
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage

logger = logging.getLogger(__name__)


class LiteLLMResponse:
    """Response object that mimics LangChain response format."""
    def __init__(self, content: str):
        self.content = content


class LiteLLMClient:
    """
    Async wrapper for OpenAI client that connects to LiteLLM proxy.

    Maintains compatibility with LangChain's ainvoke() interface while using
    OpenAI Python client under the hood for LiteLLM proxy support.
    """

    def __init__(self, api_key: str, base_url: str, model: str, temperature: float = 0):
        """
        Initialize LiteLLM client.

        Args:
            api_key: LiteLLM API key
            base_url: LiteLLM proxy URL (e.g., https://llm.atko.ai)
            model: Model name (e.g., claude-4-5-sonnet)
            temperature: Sampling temperature (0 = deterministic)
        """
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = model
        self.temperature = temperature
        logger.info(f"[LiteLLM] Initialized with model={model}, base_url={base_url}")

    async def ainvoke(self, messages: List[BaseMessage]) -> LiteLLMResponse:
        """
        Invoke LLM with LangChain-style messages.

        Args:
            messages: List of LangChain message objects (SystemMessage, HumanMessage)

        Returns:
            LiteLLMResponse with .content attribute containing LLM response text
        """
        # Convert LangChain messages to OpenAI format
        openai_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                openai_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                openai_messages.append({"role": "user", "content": msg.content})
            else:
                # Fallback for other message types
                role = getattr(msg, "role", "user")
                openai_messages.append({"role": role, "content": msg.content})

        logger.debug(f"[LiteLLM] Calling {self.model} with {len(openai_messages)} messages")

        # Call LiteLLM proxy via OpenAI client
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=openai_messages,
            temperature=self.temperature
        )

        content = response.choices[0].message.content
        logger.debug(f"[LiteLLM] Response length: {len(content)} chars")

        return LiteLLMResponse(content=content)

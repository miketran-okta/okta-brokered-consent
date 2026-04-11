/**
 * API Client for DevOps Agent Backend
 */

import { ChatResponse } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatRequestParams {
  message: string;
  sessionId?: string | null;
  idToken?: string;
}

export async function sendChatMessage({
  message,
  sessionId,
  idToken,
}: ChatRequestParams): Promise<ChatResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      session_id: sessionId,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getConfig() {
  const response = await fetch(`${API_URL}/api/config`);
  if (!response.ok) {
    throw new Error(`Config error: ${response.status}`);
  }
  return response.json();
}

export async function getAgentInfo() {
  const response = await fetch(`${API_URL}/api/agent`);
  if (!response.ok) {
    throw new Error(`Agent info error: ${response.status}`);
  }
  return response.json();
}

export async function resetDemo() {
  const response = await fetch(`${API_URL}/api/demo/reset`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Reset error: ${response.status}`);
  }
  return response.json();
}

export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}

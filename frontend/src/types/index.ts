// GitHub Data Types
export interface Repository {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  visibility: string;
  default_branch: string;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  base_branch: string;
  draft: boolean;
  mergeable?: boolean;
}

export interface Issue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  comments: number;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  agentFlow?: AgentFlowStep[];
  tokenExchanges?: TokenExchange[];
  githubData?: GitHubData;
  interactionRequired?: boolean;
  interactionUri?: string;
}

export interface GitHubData {
  repositories?: Repository[];
  pull_requests?: PullRequest[];
  issues?: Issue[];
  count?: number;
}

// Agent Flow Types
export interface AgentFlowStep {
  step: string;
  action: string;
  status: "processing" | "completed" | "pending" | "error";
}

// Decoded JWT Token Details
export interface DecodedToken {
  header?: {
    alg?: string;
    kid?: string;
    typ?: string;
  };
  payload?: {
    iss?: string;
    sub?: string;
    aud?: string;
    iat?: number;
    exp?: number;
    jti?: string;
    email?: string;
    name?: string;
    scp?: string[];
    scope?: string;
    [key: string]: unknown;
  };
  signature_preview?: string;
  raw_token_preview?: string;
  error?: string;
}

export interface TokenInfo {
  decoded?: DecodedToken;
  token_preview?: string;
  token_type?: string;
  expires_in?: number;
}

export interface TokenDetails {
  id_token?: TokenInfo;
  client_assertion?: TokenInfo;
  access_token?: TokenInfo;
}

// Token Exchange Types
export interface TokenExchange {
  agent: string;
  agent_name: string;
  color: string;
  success: boolean;
  access_denied: boolean;
  status: "granted" | "denied" | "interaction_required" | "consent_required" | "error";
  scopes: string[];
  requested_scopes: string[];
  error?: string;
  interaction_uri?: string;  // URL for user to authorize at ISV
  demo_mode: boolean;
  token_details?: TokenDetails;  // Decoded token information
}

// API Response Types
export interface ChatResponse {
  content: string;
  session_id: string;
  agent_flow: AgentFlowStep[];
  token_exchanges: TokenExchange[];
  github_data?: GitHubData;
  user_info?: UserInfo;
  // OAuth-STS interaction flow
  interaction_required?: boolean;
  interaction_uri?: string;  // URL to redirect user for GitHub authorization
}

export interface UserInfo {
  sub?: string;
  email?: string;
  name?: string;
  groups?: string[];
}

// User Profile
export interface UserProfile {
  name: string;
  email: string;
  image?: string;
  groups?: string[];
}

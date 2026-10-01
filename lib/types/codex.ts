export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CodexTokenBundle {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  expiresAt: string;
  expiresIn?: number;
  idToken?: string;
}

export interface CodexCredentialValues {
  accessToken: string;
  refreshToken: string;
  accountId?: string;
  expiresAt: string;
  idToken?: string;
}

export interface DeviceCodeStartResponse {
  deviceAuthId: string;
  userCode: string;
  interval: number;
  verificationUrl: string;
}

export interface DeviceCodePollSuccess {
  authorizationCode: string;
  codeVerifier: string;
}

export interface CodexResolvedAuth {
  token: string;
  accountId?: string;
  updatedBundle?: CodexTokenBundle;
}

export interface CodexAgentResult {
  output: string;
  threadId: string | null;
  items: unknown[];
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } | null;
  model: string;
  finishReason: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type Personality = 'default' | 'friendly' | 'pragmatic';
export type SandboxMode = 'read_only' | 'workspace_write' | 'full_access';
export type ThreadMode = 'new' | 'continue' | 'resume';

export interface RunCodexAgentParams {
  prompt: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  personality: Personality;
  threadMode: ThreadMode;
  threadId?: string;
  sandbox: SandboxMode;
  workingDirectory?: string;
  outputSchema?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  streamProgress?: boolean;
  onProgress?: (message: string) => void;
  tokenBundle: CodexTokenBundle;
  codexHome: string;
  additionalDirectories?: string[];
}

export interface AgentIdentityAuthRecord {
  agent_runtime_id: string;
  agent_private_key: string;
  account_id?: string;
  chatgpt_user_id?: string;
  email?: string;
  task_id?: string | null;
  [key: string]: unknown;
}

export interface CodexAuthJson {
  auth_mode: 'chatgpt';
  OPENAI_API_KEY: null;
  tokens: {
    id_token?: string;
    access_token: string;
    refresh_token: string;
    account_id: string;
  };
  last_refresh?: string;
  agent_identity?: string | AgentIdentityAuthRecord | Record<string, unknown>;
}

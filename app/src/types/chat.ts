export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  toolsUsed?: string[];
}

export interface ChatResponse {
  response: string;
  thread_id: string;
  tools_used: string[];
}

export interface HealthResponse {
  status: string;
  env: string;
  llm_configured: boolean;
  model: string;
}

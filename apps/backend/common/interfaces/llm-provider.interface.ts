export interface LLMProviderConfig {
  type: 'openai' | 'ollama';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
}

export interface LLMCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMProvider {
  createCompletion(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse>;
  getModel(): string;
  isAvailable(): Promise<boolean>;
}

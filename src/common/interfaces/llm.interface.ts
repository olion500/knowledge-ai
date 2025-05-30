export interface LLMRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

export interface SummaryRequest {
  content: string;
  contentType: 'slack' | 'jira';
  context?: {
    channel?: string;
    project?: string;
    participants?: string[];
  };
}

export interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
  participants: string[];
  tags: string[];
}

export interface ClassificationRequest {
  content: string;
  availableTopics: string[];
  context?: {
    source: 'slack' | 'jira';
    metadata?: Record<string, any>;
  };
}

export interface ClassificationResponse {
  topic: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
}

export interface DocumentGenerationRequest {
  summary: SummaryResponse;
  classification: ClassificationResponse;
  originalContent: {
    source: 'slack' | 'jira';
    data: any;
    timestamp: string;
  };
  existingDocument?: string;
}

export interface DocumentGenerationResponse {
  title: string;
  content: string;
  metadata: {
    topic: string;
    tags: string[];
    lastUpdated: string;
    sources: string[];
    participants: string[];
  };
  isUpdate: boolean;
  changesSummary?: string;
} 
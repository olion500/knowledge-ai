export interface CodeChangeContext {
  repository: {
    owner: string;
    name: string;
    fullName: string;
    description?: string;
    language?: string;
  };
  commits: {
    from: string;
    to: string;
    count: number;
    details: {
      sha: string;
      message: string;
      author: string;
      date: string;
    }[];
  };
  changes: {
    added: CodeFunctionChange[];
    modified: CodeFunctionChange[];
    deleted: CodeFunctionChange[];
  };
  summary: {
    totalFunctions: number;
    changedFunctions: number;
    significantChanges: number;
    complexity: {
      average: number;
      highest: number;
    };
  };
}

export interface CodeFunctionChange {
  functionName: string;
  className?: string;
  filePath: string;
  signature: string;
  changeType: 'added' | 'modified' | 'deleted';
  impact: 'low' | 'medium' | 'high';
  description: string;
  complexity?: {
    cyclomaticComplexity: number;
    linesOfCode: number;
  };
  isPublic: boolean;
  isExported: boolean;
}

export interface DocumentationUpdateRequest {
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  changeContext: CodeChangeContext;
  existingDocumentation?: {
    readme?: string;
    apiDocs?: string;
    changelog?: string;
  };
  updatePreferences: {
    includeReadme: boolean;
    includeApiDocs: boolean;
    includeChangelog: boolean;
    focusOnPublicApi: boolean;
    includeCodeExamples: boolean;
  };
}

export interface DocumentationUpdateResponse {
  shouldUpdate: boolean;
  confidence: number; // 0-100
  reasoning: string;
  suggestedUpdates: {
    readme?: {
      shouldUpdate: boolean;
      sections: string[];
      priority: 'low' | 'medium' | 'high';
      suggestedContent?: string;
    };
    apiDocs?: {
      shouldUpdate: boolean;
      affectedEndpoints: string[];
      priority: 'low' | 'medium' | 'high';
      suggestedContent?: string;
    };
    changelog?: {
      shouldUpdate: boolean;
      entryType: 'patch' | 'minor' | 'major';
      priority: 'low' | 'medium' | 'high';
      suggestedEntry?: string;
    };
  };
  metadata: {
    analysisDate: string;
    llmModel: string;
    processingTime: number;
  };
}

export interface LLMAnalysisConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  analysisPrompts: {
    codeChange: string;
    documentationImpact: string;
    changelogGeneration: string;
  };
}

export interface CodeAnalysisPrompt {
  type: 'code_change_analysis' | 'documentation_impact' | 'changelog_generation';
  context: CodeChangeContext;
  instruction: string;
  expectedOutput: 'json' | 'markdown' | 'text';
} 
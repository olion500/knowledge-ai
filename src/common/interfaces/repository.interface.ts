export interface RepositoryInfo {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  description?: string;
  language?: string;
  isPrivate: boolean;
  metadata?: {
    stars?: number;
    forks?: number;
    size?: number;
    topics?: string[];
    [key: string]: any;
  };
}

export interface RepositorySyncConfig {
  includePaths?: string[];
  excludePaths?: string[];
  fileExtensions?: string[];
  syncFrequency?: 'daily' | 'weekly' | 'manual';
  autoDocGeneration?: boolean;
}

export interface RepositoryAnalysisResult {
  repositoryId: string;
  totalFiles: number;
  analyzedFiles: number;
  languages: Record<string, number>;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  complexity: CodeComplexity;
}

export interface FunctionInfo {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  signature: string;
  parameters: ParameterInfo[];
  returnType?: string;
  complexity: number;
  documentation?: string;
}

export interface ClassInfo {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements?: string[];
  documentation?: string;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility?: 'public' | 'private' | 'protected';
  static?: boolean;
  readonly?: boolean;
}

export interface CodeComplexity {
  cyclomatic: number;
  cognitive: number;
  maintainabilityIndex: number;
  linesOfCode: number;
}

export interface GitHubCommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
} 
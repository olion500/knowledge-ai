export type ReferenceType = 'line' | 'function' | 'range';

export interface CodeLinkInfo {
  type: ReferenceType;
  owner: string;
  repo: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  functionName?: string;
  originalText: string;
  context: string;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  filePath: string;
}

export interface GitHubInfo {
  owner: string;
  repo: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  functionName?: string;
}

export interface CodeReferenceValidation {
  repositoryOwner: string;
  repositoryName: string;
  filePath: string;
  referenceType: ReferenceType;
  startLine?: number;
  endLine?: number;
  functionName?: string;
}

export interface LineBasedCodeResult {
  content: string;
  lineNumbers: number[];
  totalLines: number;
  sha: string;
}

export interface FunctionBasedCodeResult {
  content: string;
  functionName: string;
  startLine: number;
  endLine: number;
  sha: string;
}

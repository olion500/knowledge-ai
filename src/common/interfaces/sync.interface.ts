export interface SyncJob {
  id: string;
  repositoryId: string;
  type: 'scheduled' | 'manual' | 'webhook';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  metadata?: {
    fromCommit?: string;
    toCommit?: string;
    filesAnalyzed?: number;
    functionsFound?: number;
    changesDetected?: number;
    [key: string]: any;
  };
}

export interface SyncResult {
  jobId: string;
  repositoryId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  summary: {
    totalFiles: number;
    analyzedFiles: number;
    newFunctions: number;
    modifiedFunctions: number;
    deletedFunctions: number;
    errors: number;
  };
  commits: {
    from: string;
    to: string;
    count: number;
  };
  errors?: string[];
}

export interface SyncConfig {
  enabled: boolean;
  schedule: string; // cron expression
  maxRetries: number;
  retryDelay: number; // in milliseconds
  timeout: number; // in milliseconds
  concurrentJobs: number;
  webhookEnabled: boolean;
  webhookSecret?: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
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
  files?: {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export interface SyncProgress {
  jobId: string;
  stage:
    | 'initializing'
    | 'fetching_commits'
    | 'analyzing_files'
    | 'saving_results'
    | 'completed';
  progress: number; // 0-100
  currentFile?: string;
  processedFiles: number;
  totalFiles: number;
  message?: string;
}

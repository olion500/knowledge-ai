export interface GitHubRepository {
  owner: string;
  repo: string;
  branch?: string;
}

export interface GitHubFile {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
  sha?: string;
}

export interface GitHubCommit {
  message: string;
  author: {
    name: string;
    email: string;
  };
  files: GitHubFile[];
}

export interface GitHubPullRequest {
  title: string;
  body: string;
  head: string;
  base: string;
  reviewers?: string[];
  assignees?: string[];
  labels?: string[];
}

export interface GitHubBranch {
  name: string;
  sha: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubCreateFileRequest {
  message: string;
  content: string;
  branch?: string;
  author?: {
    name: string;
    email: string;
  };
  committer?: {
    name: string;
    email: string;
  };
}

export interface GitHubUpdateFileRequest extends GitHubCreateFileRequest {
  sha: string;
} 
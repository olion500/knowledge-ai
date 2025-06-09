import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import {
  GitHubRepository,
  GitHubFile,
  GitHubPullRequest,
  GitHubContent,
  GitHubCreateFileRequest,
  GitHubUpdateFileRequest,
} from '../../common/interfaces/github.interface';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly octokit: Octokit;
  private readonly defaultRepo: GitHubRepository;

  constructor(private readonly configService: ConfigService) {
    this.octokit = new Octokit({
      auth: this.configService.get<string>('GITHUB_TOKEN'),
    });

    this.defaultRepo = {
      owner: this.configService.get<string>('GITHUB_OWNER')!,
      repo: this.configService.get<string>('GITHUB_REPO')!,
      branch: 'main',
    };
  }

  async createBranch(branchName: string, baseBranch = 'main'): Promise<void> {
    try {
      // Get the SHA of the base branch
      const { data: baseRef } = await this.octokit.git.getRef({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        ref: `heads/${baseBranch}`,
      });

      // Create new branch
      await this.octokit.git.createRef({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha,
      });

      this.logger.log(`Created branch: ${branchName}`);
    } catch (error) {
      this.logger.error(`Failed to create branch ${branchName}`, error);
      throw error;
    }
  }

  async getFileContent(
    filePath: string,
    branch = 'main',
  ): Promise<GitHubContent | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        path: filePath,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return data as GitHubContent;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      this.logger.error(`Failed to get file content for ${filePath}`, error);
      throw error;
    }
  }

  async createFile(
    filePath: string,
    request: GitHubCreateFileRequest,
    branch = 'main',
  ): Promise<string> {
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        path: filePath,
        message: request.message,
        content: Buffer.from(request.content, 'utf-8').toString('base64'),
        branch,
        author: request.author,
        committer: request.committer,
      });

      this.logger.log(`Created file: ${filePath} in branch: ${branch}`);
      return data.commit?.sha || data.content?.sha || '';
    } catch (error) {
      this.logger.error(`Failed to create file ${filePath}`, error);
      throw error;
    }
  }

  async updateFile(
    filePath: string,
    request: GitHubUpdateFileRequest,
    branch = 'main',
  ): Promise<string> {
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        path: filePath,
        message: request.message,
        content: Buffer.from(request.content, 'utf-8').toString('base64'),
        sha: request.sha,
        branch,
        author: request.author,
        committer: request.committer,
      });

      this.logger.log(`Updated file: ${filePath} in branch: ${branch}`);
      return data.commit?.sha || data.content?.sha || '';
    } catch (error) {
      this.logger.error(`Failed to update file ${filePath}`, error);
      throw error;
    }
  }

  async createOrUpdateFile(
    filePath: string,
    content: string,
    commitMessage: string,
    branch = 'main',
  ): Promise<string> {
    const existingFile = await this.getFileContent(filePath, branch);

    const request = {
      message: commitMessage,
      content,
      author: {
        name: 'Knowledge Sync AI',
        email: 'knowledge-sync-ai@example.com',
      },
    };

    if (existingFile) {
      return this.updateFile(
        filePath,
        { ...request, sha: existingFile.sha },
        branch,
      );
    } else {
      return this.createFile(filePath, request, branch);
    }
  }

  async createPullRequest(
    pullRequest: GitHubPullRequest,
  ): Promise<{ number: number; url: string }> {
    try {
      const { data } = await this.octokit.pulls.create({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        title: pullRequest.title,
        body: pullRequest.body,
        head: pullRequest.head,
        base: pullRequest.base,
      });

      this.logger.log(`Created PR #${data.number}: ${pullRequest.title}`);

      // Add reviewers if specified (handle failures gracefully)
      if (pullRequest.reviewers && pullRequest.reviewers.length > 0) {
        try {
          await this.octokit.pulls.requestReviewers({
            owner: this.defaultRepo.owner,
            repo: this.defaultRepo.repo,
            pull_number: data.number,
            reviewers: pullRequest.reviewers,
          });
          this.logger.log(
            `Added reviewers to PR #${data.number}: ${pullRequest.reviewers.join(', ')}`,
          );
        } catch (reviewerError) {
          this.logger.warn(
            `Failed to add reviewers to PR #${data.number}. Reviewers must be collaborators of the repository.`,
            {
              requestedReviewers: pullRequest.reviewers,
              error: reviewerError.message,
            },
          );
        }
      }

      // Add assignees if specified (handle failures gracefully)
      if (pullRequest.assignees && pullRequest.assignees.length > 0) {
        try {
          await this.octokit.issues.addAssignees({
            owner: this.defaultRepo.owner,
            repo: this.defaultRepo.repo,
            issue_number: data.number,
            assignees: pullRequest.assignees,
          });
          this.logger.log(
            `Added assignees to PR #${data.number}: ${pullRequest.assignees.join(', ')}`,
          );
        } catch (assigneeError) {
          this.logger.warn(
            `Failed to add assignees to PR #${data.number}. Assignees must be collaborators of the repository.`,
            {
              requestedAssignees: pullRequest.assignees,
              error: assigneeError.message,
            },
          );
        }
      }

      // Add labels if specified (handle failures gracefully)
      if (pullRequest.labels && pullRequest.labels.length > 0) {
        try {
          await this.octokit.issues.addLabels({
            owner: this.defaultRepo.owner,
            repo: this.defaultRepo.repo,
            issue_number: data.number,
            labels: pullRequest.labels,
          });
          this.logger.log(
            `Added labels to PR #${data.number}: ${pullRequest.labels.join(', ')}`,
          );
        } catch (labelError) {
          this.logger.warn(`Failed to add labels to PR #${data.number}`, {
            requestedLabels: pullRequest.labels,
            error: labelError.message,
          });
        }
      }

      return {
        number: data.number,
        url: data.html_url,
      };
    } catch (error) {
      this.logger.error('Failed to create pull request', error);
      throw error;
    }
  }

  async generateDocumentPath(topic: string, title: string): Promise<string> {
    const basePath = this.configService.get<string>('DOCS_BASE_PATH') || 'docs';
    const sanitizedTopic = topic.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    return `${basePath}/${sanitizedTopic}/${sanitizedTitle}.md`;
  }

  async listDirectoryContents(
    dirPath: string,
    branch = 'main',
  ): Promise<GitHubContent[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.defaultRepo.owner,
        repo: this.defaultRepo.repo,
        path: dirPath,
        ref: branch,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data as GitHubContent[];
    } catch (error) {
      if (error.status === 404) {
        return [];
      }
      this.logger.error(
        `Failed to list directory contents for ${dirPath}`,
        error,
      );
      throw error;
    }
  }

  async findExistingDocument(topic: string): Promise<GitHubContent | null> {
    const basePath = this.configService.get<string>('DOCS_BASE_PATH') || 'docs';
    const sanitizedTopic = topic.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const topicPath = `${basePath}/${sanitizedTopic}`;

    try {
      const contents = await this.listDirectoryContents(topicPath);

      // Find markdown documents in the topic directory
      const markdownFiles = contents
        .filter((file) => file.type === 'file' && file.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name descending (alphabetical)

      return markdownFiles.length > 0 ? markdownFiles[0] : null;
    } catch (error) {
      this.logger.error(
        `Failed to find existing document for topic ${topic}`,
        error,
      );
      return null;
    }
  }

  // Repository 관련 메서드들 추가
  async getRepositoryInfo(owner: string, name: string): Promise<any> {
    try {
      const { data } = await this.octokit.repos.get({
        owner,
        repo: name,
      });

      return {
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        defaultBranch: data.default_branch,
        description: data.description,
        language: data.language,
        isPrivate: data.private,
        metadata: {
          stars: data.stargazers_count,
          forks: data.forks_count,
          size: data.size,
          topics: data.topics || [],
          openIssues: data.open_issues_count,
          watchers: data.watchers_count,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          pushedAt: data.pushed_at,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get repository info for ${owner}/${name}`,
        error,
      );
      throw error;
    }
  }

  async getLatestCommit(
    owner: string,
    name: string,
    branch: string,
  ): Promise<any> {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo: name,
        ref: branch,
      });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: {
          name: data.commit.author?.name || 'Unknown',
          email: data.commit.author?.email || 'unknown@example.com',
          date: data.commit.author?.date || new Date().toISOString(),
        },
        url: data.html_url,
        stats: data.stats
          ? {
              additions: data.stats.additions,
              deletions: data.stats.deletions,
              total: data.stats.total,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get latest commit for ${owner}/${name}:${branch}`,
        error,
      );
      throw error;
    }
  }

  async getCommitsBetween(
    owner: string,
    name: string,
    since: string,
    until?: string,
  ): Promise<any[]> {
    try {
      const params: any = {
        owner,
        repo: name,
        since,
      };

      if (until) {
        params.until = until;
      }

      const { data } = await this.octokit.repos.listCommits(params);

      return data.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || 'unknown@example.com',
          date: commit.commit.author?.date || new Date().toISOString(),
        },
        url: commit.html_url,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get commits between ${since} and ${until} for ${owner}/${name}`,
        error,
      );
      throw error;
    }
  }

  async getRepositoryLanguages(
    owner: string,
    name: string,
  ): Promise<Record<string, number>> {
    try {
      const { data } = await this.octokit.repos.listLanguages({
        owner,
        repo: name,
      });

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to get repository languages for ${owner}/${name}`,
        error,
      );
      throw error;
    }
  }

  async getRepositoryContents(
    owner: string,
    name: string,
    path = '',
    branch?: string,
  ): Promise<GitHubContent[]> {
    try {
      const params: any = {
        owner,
        repo: name,
        path,
      };

      if (branch) {
        params.ref = branch;
      }

      const { data } = await this.octokit.repos.getContent(params);

      if (!Array.isArray(data)) {
        return [data as GitHubContent];
      }

      return data as GitHubContent[];
    } catch (error) {
      if (error.status === 404) {
        return [];
      }
      this.logger.error(
        `Failed to get repository contents for ${owner}/${name}:${path}`,
        error,
      );
      throw error;
    }
  }

  async getCommits(
    owner: string,
    repo: string,
    options?: {
      since?: string;
      until?: string;
      sha?: string;
      per_page?: number;
      page?: number;
    },
  ): Promise<any[]> {
    try {
      const { data } = await this.octokit.repos.listCommits({
        owner,
        repo,
        ...options,
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to get commits for ${owner}/${repo}`, error);
      throw error;
    }
  }
}

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

  async getFileContent(filePath: string, branch = 'main'): Promise<GitHubContent | null> {
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
      return this.updateFile(filePath, { ...request, sha: existingFile.sha }, branch);
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
          this.logger.log(`Added reviewers to PR #${data.number}: ${pullRequest.reviewers.join(', ')}`);
        } catch (reviewerError) {
          this.logger.warn(`Failed to add reviewers to PR #${data.number}. Reviewers must be collaborators of the repository.`, {
            requestedReviewers: pullRequest.reviewers,
            error: reviewerError.message,
          });
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
          this.logger.log(`Added assignees to PR #${data.number}: ${pullRequest.assignees.join(', ')}`);
        } catch (assigneeError) {
          this.logger.warn(`Failed to add assignees to PR #${data.number}. Assignees must be collaborators of the repository.`, {
            requestedAssignees: pullRequest.assignees,
            error: assigneeError.message,
          });
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
          this.logger.log(`Added labels to PR #${data.number}: ${pullRequest.labels.join(', ')}`);
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
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    return `${basePath}/${sanitizedTopic}/${timestamp}-${sanitizedTitle}.md`;
  }

  async listDirectoryContents(dirPath: string, branch = 'main'): Promise<GitHubContent[]> {
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
      this.logger.error(`Failed to list directory contents for ${dirPath}`, error);
      throw error;
    }
  }

  async findExistingDocument(topic: string): Promise<GitHubContent | null> {
    const basePath = this.configService.get<string>('DOCS_BASE_PATH') || 'docs';
    const sanitizedTopic = topic.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const topicPath = `${basePath}/${sanitizedTopic}`;

    try {
      const contents = await this.listDirectoryContents(topicPath);
      
      // Find the most recent document in the topic directory
      // Only consider files with date format (YYYY-MM-DD-)
      const markdownFiles = contents
        .filter(file => 
          file.type === 'file' && 
          file.name.endsWith('.md') && 
          /^\d{4}-\d{2}-\d{2}-/.test(file.name)
        )
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name descending (most recent first)

      return markdownFiles.length > 0 ? markdownFiles[0] : null;
    } catch (error) {
      this.logger.error(`Failed to find existing document for topic ${topic}`, error);
      return null;
    }
  }
} 
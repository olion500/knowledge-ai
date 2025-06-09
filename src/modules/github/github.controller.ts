import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  Headers,
} from '@nestjs/common';
import { GitHubService } from './github.service';

interface GitHubWebhookPayload {
  repository?: {
    full_name: string;
  };
  commits?: Array<{
    message: string;
    id: string;
  }>;
  action?: string;
  pull_request?: {
    title: string;
    number: number;
  };
  issue?: {
    title: string;
    number: number;
  };
  comment?: {
    body: string;
  };
  review?: {
    state: string;
  };
}

@Controller('github')
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(private readonly githubService: GitHubService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleGitHubWebhook(
    @Body() payload: GitHubWebhookPayload,
    @Headers('x-github-event') eventType: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Received GitHub webhook: ${eventType}`);

    try {
      // Handle different GitHub events
      switch (eventType) {
        case 'push':
          this.handlePushEvent(payload);
          break;
        case 'pull_request':
          this.handlePullRequestEvent(payload);
          break;
        case 'issues':
          this.handleIssuesEvent(payload);
          break;
        case 'issue_comment':
          this.handleIssueCommentEvent(payload);
          break;
        case 'pull_request_review':
          this.handlePullRequestReviewEvent(payload);
          break;
        default:
          this.logger.log(`Unhandled GitHub event: ${eventType}`);
      }

      return { message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error('Error processing GitHub webhook', error);
      return { message: 'Error processing webhook' };
    }
  }

  @Post('test')
  @HttpCode(200)
  async testEndpoint(): Promise<{ message: string; timestamp: string }> {
    return {
      message: 'GitHub webhook endpoint is working!',
      timestamp: new Date().toISOString(),
    };
  }

  private handlePushEvent(payload: GitHubWebhookPayload): void {
    const { repository, commits } = payload;

    if (commits && commits.length > 0 && repository) {
      this.logger.log(
        `Processing ${commits.length} commits to ${repository.full_name}`,
      );
      // TODO: Process commits for documentation
    }
  }

  private handlePullRequestEvent(payload: GitHubWebhookPayload): void {
    const { action, pull_request, repository } = payload;

    // Process important PR events
    if (
      action &&
      ['opened', 'closed', 'merged'].includes(action) &&
      pull_request &&
      repository
    ) {
      this.logger.log(
        `PR ${action}: ${pull_request.title} in ${repository.full_name}`,
      );
      // TODO: Process PR for documentation
    }
  }

  private handleIssuesEvent(payload: GitHubWebhookPayload): void {
    const { action, issue, repository } = payload;

    // Process important issue events
    if (
      action &&
      ['opened', 'closed', 'labeled'].includes(action) &&
      issue &&
      repository
    ) {
      this.logger.log(
        `Issue ${action}: ${issue.title} in ${repository.full_name}`,
      );
      // TODO: Process issue for documentation
    }
  }

  private handleIssueCommentEvent(payload: GitHubWebhookPayload): void {
    const { action, issue, repository } = payload;

    if (action === 'created' && issue && repository) {
      this.logger.log(
        `New comment on issue #${issue.number} in ${repository.full_name}`,
      );
      // TODO: Process comment if it contains important information
    }
  }

  private handlePullRequestReviewEvent(payload: GitHubWebhookPayload): void {
    const { action, pull_request, repository } = payload;

    if (action === 'submitted' && pull_request && repository) {
      this.logger.log(
        `PR review submitted for #${pull_request.number} in ${repository.full_name}`,
      );
      // TODO: Process review if needed
    }
  }
}

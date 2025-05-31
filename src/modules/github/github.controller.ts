import { Controller, Post, Body, Logger, HttpCode, Headers } from '@nestjs/common';
import { GitHubService } from './github.service';

@Controller('github')
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(
    private readonly githubService: GitHubService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async handleGitHubWebhook(
    @Body() payload: any,
    @Headers('x-github-event') eventType: string,
    @Headers('x-hub-signature-256') signature: string,
  ): Promise<{ message: string }> {
    this.logger.log(`Received GitHub webhook: ${eventType}`);

    try {
      // Handle different GitHub events
      switch (eventType) {
        case 'push':
          await this.handlePushEvent(payload);
          break;
        case 'pull_request':
          await this.handlePullRequestEvent(payload);
          break;
        case 'issues':
          await this.handleIssuesEvent(payload);
          break;
        case 'issue_comment':
          await this.handleIssueCommentEvent(payload);
          break;
        case 'pull_request_review':
          await this.handlePullRequestReviewEvent(payload);
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

  private async handlePushEvent(payload: any): Promise<void> {
    const { repository, commits } = payload;
    
    if (commits && commits.length > 0) {
      this.logger.log(`Processing ${commits.length} commits to ${repository.full_name}`);
      // TODO: Process commits for documentation
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const { action, pull_request, repository } = payload;
    
    // Process important PR events
    if (['opened', 'closed', 'merged'].includes(action)) {
      this.logger.log(`PR ${action}: ${pull_request.title} in ${repository.full_name}`);
      // TODO: Process PR for documentation
    }
  }

  private async handleIssuesEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;
    
    // Process important issue events
    if (['opened', 'closed', 'labeled'].includes(action)) {
      this.logger.log(`Issue ${action}: ${issue.title} in ${repository.full_name}`);
      // TODO: Process issue for documentation
    }
  }

  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, comment, issue, repository } = payload;
    
    if (action === 'created') {
      this.logger.log(`New comment on issue #${issue.number} in ${repository.full_name}`);
      // TODO: Process comment if it contains important information
    }
  }

  private async handlePullRequestReviewEvent(payload: any): Promise<void> {
    const { action, review, pull_request, repository } = payload;
    
    if (action === 'submitted') {
      this.logger.log(`PR review submitted for #${pull_request.number} in ${repository.full_name}`);
      // TODO: Process review if needed
    }
  }
} 
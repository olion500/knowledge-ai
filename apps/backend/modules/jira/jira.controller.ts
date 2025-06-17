import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { JiraService } from './jira.service';
import { JiraWebhookEvent } from '../../common/interfaces/jira.interface';

@Controller('jira')
export class JiraController {
  private readonly logger = new Logger(JiraController.name);

  constructor(private readonly jiraService: JiraService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleJiraWebhook(
    @Body() event: JiraWebhookEvent,
  ): Promise<{ status: string }> {
    this.logger.log(`Received Jira webhook: ${event.webhookEvent}`);

    try {
      await this.jiraService.processWebhookEvent(event);
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Failed to process Jira webhook', error);
      return { status: 'error' };
    }
  }
}

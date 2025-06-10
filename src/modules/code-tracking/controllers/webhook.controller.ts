import { Controller, Post, Get, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GitHubWebhookService } from '../services/github-webhook.service';

@Controller('api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: GitHubWebhookService,
    private readonly configService: ConfigService,
  ) {}

  @Post('github')
  async handleGitHubWebhook(@Headers() headers: any, @Body() payload: any) {
    this.logger.log('Received GitHub webhook event');

    const eventType = headers['x-github-event'];
    const signature = headers['x-hub-signature-256'];
    
    // Validate webhook signature
    const webhookSecret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    const isValidSignature = this.webhookService.validateWebhookSignature(
      JSON.stringify(payload),
      signature,
      webhookSecret,
    );

    if (!isValidSignature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process the webhook event
    try {
      switch (eventType) {
        case 'push':
          await this.webhookService.handlePushEvent(payload);
          this.logger.log(`Successfully processed push event for ${payload.repository?.full_name}`);
          return { status: 'success', event: eventType };
        
        case 'ping':
          this.logger.log('Received GitHub webhook ping');
          return { status: 'success', event: 'ping', message: 'Webhook is configured correctly' };

        default:
          this.logger.log(`Ignoring unsupported event type: ${eventType}`);
          return { status: 'ignored', event: eventType };
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook event ${eventType}:`, error);
      throw error;
    }
  }

  @Post('process-pending')
  async processPendingEvents() {
    this.logger.log('Processing pending code change events');
    
    try {
      await this.webhookService.processPendingEvents();
      return { status: 'success', message: 'Pending events processed' };
    } catch (error) {
      this.logger.error('Failed to process pending events:', error);
      throw error;
    }
  }

  @Get('status')
  async getWebhookStatus() {
    return {
      status: 'active',
      endpoint: '/api/webhooks/github',
      supportedEvents: ['push'],
    };
  }
} 
import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { SlackService } from './slack.service';
import { DocumentService } from '../document/document.service';
import { SlackEventPayload } from '../../common/interfaces/slack.interface';

@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly documentService: DocumentService,
  ) {}

  @Post('events')
  @HttpCode(200)
  async handleSlackEvent(@Body() payload: SlackEventPayload): Promise<{ challenge?: string }> {
    this.logger.log('Received Slack event', payload.type);

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: (payload as any).challenge };
    }

    // Handle message events
    if (payload.type === 'event_callback' && payload.event) {
      await this.processSlackEvent(payload);
    }

    return {};
  }

  @Post('collect')
  @HttpCode(200)
  async collectMessages(@Body() request: {
    channelId: string;
    reactionName?: string;
    keywords?: string[];
    hours?: number;
  }): Promise<{ message: string; count: number }> {
    const { channelId, reactionName, keywords, hours = 24 } = request;
    
    const oldest = new Date(Date.now() - hours * 60 * 60 * 1000).getTime() / 1000;
    
    let messages;
    
    if (reactionName) {
      messages = await this.slackService.getMessagesWithReaction(
        channelId,
        reactionName,
        oldest.toString(),
      );
    } else if (keywords && keywords.length > 0) {
      messages = await this.slackService.getMessagesWithKeywords(
        channelId,
        keywords,
        oldest.toString(),
      );
    } else {
      messages = await this.slackService.getChannelHistory(
        channelId,
        oldest.toString(),
      );
    }

    if (messages.length > 0) {
      await this.documentService.processSlackMessages(messages);
    }

    return {
      message: `Processed ${messages.length} messages from channel ${channelId}`,
      count: messages.length,
    };
  }

  private async processSlackEvent(payload: SlackEventPayload): Promise<void> {
    const { event } = payload;

    // Only process message events with specific reactions or keywords
    if (event.type === 'reaction_added') {
      await this.handleReactionAdded(event as any);
    } else if (event.type === 'message') {
      await this.handleMessage(event);
    }
  }

  private async handleReactionAdded(event: any): Promise<void> {
    // Check if it's a reaction we care about (e.g., 📝, 📋, 🔖)
    const importantReactions = ['memo', 'clipboard', 'bookmark_tabs'];
    
    if (importantReactions.includes(event.reaction)) {
      const messages = await this.slackService.getChannelHistory(
        event.item.channel,
        event.item.ts,
        (parseFloat(event.item.ts) + 1).toString(),
      );

      if (messages.length > 0) {
        await this.documentService.processSlackMessages(messages);
      }
    }
  }

  private async handleMessage(event: any): Promise<void> {
    // Check for specific keywords that indicate important discussions
    const keywords = ['decision', 'action item', 'todo', 'follow up', 'next steps'];
    const messageText = event.text?.toLowerCase() || '';
    
    const hasKeyword = keywords.some(keyword => messageText.includes(keyword));
    
    if (hasKeyword) {
      const messages = await this.slackService.getChannelHistory(
        event.channel,
        event.ts,
        (parseFloat(event.ts) + 1).toString(),
      );

      if (messages.length > 0) {
        await this.documentService.processSlackMessages(messages);
      }
    }
  }
} 
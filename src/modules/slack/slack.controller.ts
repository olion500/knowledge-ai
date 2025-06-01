import { Controller, Post, Body, Logger, HttpCode } from '@nestjs/common';
import { SlackService } from './slack.service';
import { DocumentService } from '../document/document.service';
import { SlackEventPayload } from '../../common/interfaces/slack.interface';

@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);
  private readonly processedEvents = new Map<string, number>(); // eventId -> timestamp
  private readonly EVENT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private readonly slackService: SlackService,
    private readonly documentService: DocumentService,
  ) {
    // Clean up old events every 30 minutes (only in non-test environment)
    if (process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => this.cleanupOldEvents(), 30 * 60 * 1000);
    }
  }

  @Post('events')
  @HttpCode(200)
  async handleSlackEvent(@Body() payload: SlackEventPayload): Promise<{ challenge?: string }> {
    this.logger.log('Received Slack event', payload.type);

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: (payload as any).challenge };
    }

    // Handle message events with duplicate prevention
    if (payload.type === 'event_callback' && payload.event) {
      // Create a unique identifier for this event
      const eventKey = payload.eventId || `${payload.event.type}_${payload.event.eventTs || payload.event.ts}`;
      
      // Check if we've already processed this event
      if (this.processedEvents.has(eventKey)) {
        this.logger.log(`Duplicate event detected, skipping: ${eventKey}`);
        return {};
      }

      // Mark this event as processed
      this.processedEvents.set(eventKey, Date.now());
      
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
    
    this.logger.log(`Processing event type: ${event.type}`);
    this.logger.log(`Event details:`, JSON.stringify(event, null, 2));

    // Only process message events with specific reactions or keywords
    if (event.type === 'reaction_added') {
      this.logger.log('Processing reaction_added event');
      await this.handleReactionAdded(event as any);
    } else if (event.type === 'message') {
      this.logger.log('Processing message event');
      await this.handleMessage(event);
    } else {
      this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleReactionAdded(event: any): Promise<void> {
    // Check if it's a reaction we care about (e.g., 📝, 📋, 🔖)
    const importantReactions = ['memo', 'clipboard', 'bookmark_tabs'];
    
    this.logger.log(`Reaction added: ${event.reaction}`);
    
    if (importantReactions.includes(event.reaction)) {
      this.logger.log(`Important reaction detected: ${event.reaction}, processing messages...`);
      
      // Get recent messages around the reacted message
      const messages = await this.slackService.getChannelHistory(
        event.item.channel,
        undefined, // Get recent messages
        undefined,
      );

      this.logger.log(`Found ${messages.length} messages to process`);

      if (messages.length > 0) {
        // Filter to get the specific message and some context
        const targetMessage = messages.find(m => m.id === event.item.ts);
        const messagesToProcess = targetMessage ? [targetMessage] : messages.slice(0, 5);
        
        await this.documentService.processSlackMessages(messagesToProcess);
        this.logger.log(`Processed ${messagesToProcess.length} messages successfully`);
      }
    } else {
      this.logger.log(`Reaction ${event.reaction} not in important list, ignoring`);
    }
  }

  private async handleMessage(event: any): Promise<void> {
    // Check for specific keywords that indicate important discussions
    const keywords = ['decision', 'action item', 'todo', 'follow up', 'next steps'];
    const messageText = event.text?.toLowerCase() || '';
    
    this.logger.log(`Message text: "${event.text}"`);
    this.logger.log(`Checking for keywords: ${keywords.join(', ')}`);
    
    const hasKeyword = keywords.some(keyword => messageText.includes(keyword));
    
    if (hasKeyword) {
      this.logger.log('Important keyword found, processing messages...');
      
      // Get recent messages including the current one
      const messages = await this.slackService.getChannelHistory(
        event.channel,
        undefined, // Get recent messages
        undefined,
      );

      this.logger.log(`Found ${messages.length} messages to process`);

      if (messages.length > 0) {
        // Find the specific message and include some context (5 recent messages)
        const messagesToProcess = messages.slice(0, 5);
        await this.documentService.processSlackMessages(messagesToProcess);
        this.logger.log(`Processed ${messagesToProcess.length} messages successfully`);
      }
    } else {
      this.logger.log('No important keywords found, ignoring message');
    }
  }

  private cleanupOldEvents(): void {
    const now = Date.now();
    this.processedEvents.forEach((timestamp, eventId) => {
      if (now - timestamp > this.EVENT_CACHE_DURATION) {
        this.processedEvents.delete(eventId);
      }
    });
  }

  // Method to clean up resources (useful for testing)
  onDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
} 
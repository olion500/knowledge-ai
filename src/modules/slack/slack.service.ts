import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { SlackMessage, SlackChannel, SlackUser } from '../../common/interfaces/slack.interface';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly slackClient: WebClient;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    this.slackClient = new WebClient(token);
  }

  async getChannels(): Promise<SlackChannel[]> {
    try {
      const result = await this.slackClient.conversations.list({
        types: 'public_channel,private_channel',
        limit: 1000,
      });

      return result.channels?.map(channel => ({
        id: channel.id!,
        name: channel.name!,
        isPrivate: channel.is_private || false,
        members: (channel as any).members,
      })) || [];
    } catch (error) {
      this.logger.error('Failed to fetch channels', error);
      throw error;
    }
  }

  async getChannelHistory(
    channelId: string,
    oldest?: string,
    latest?: string,
  ): Promise<SlackMessage[]> {
    try {
      const result = await this.slackClient.conversations.history({
        channel: channelId,
        oldest,
        latest,
        limit: 1000,
      });

      const messages: SlackMessage[] = [];

      for (const message of result.messages || []) {
        if (message.type === 'message' && message.text) {
          const slackMessage: SlackMessage = {
            id: message.ts!,
            channel: channelId,
            user: message.user!,
            text: message.text,
            timestamp: message.ts!,
            threadTs: message.thread_ts,
            reactions: message.reactions?.map(reaction => ({
              name: reaction.name!,
              count: reaction.count!,
              users: reaction.users || [],
            })),
            files: message.files?.map(file => ({
              id: file.id!,
              name: file.name!,
              mimetype: file.mimetype!,
              url: file.url_private!,
              size: file.size!,
            })),
          };

          messages.push(slackMessage);

          // Get thread replies if this is a thread parent
          if (message.reply_count && message.reply_count > 0) {
            const threadReplies = await this.getThreadReplies(channelId, message.ts!);
            messages.push(...threadReplies);
          }
        }
      }

      return messages;
    } catch (error) {
      this.logger.error(`Failed to fetch channel history for ${channelId}`, error);
      throw error;
    }
  }

  async getThreadReplies(channelId: string, threadTs: string): Promise<SlackMessage[]> {
    try {
      const result = await this.slackClient.conversations.replies({
        channel: channelId,
        ts: threadTs,
      });

      return result.messages?.slice(1).map(message => ({
        id: message.ts!,
        channel: channelId,
        user: message.user!,
        text: message.text!,
        timestamp: message.ts!,
        threadTs: threadTs,
        reactions: message.reactions?.map(reaction => ({
          name: reaction.name!,
          count: reaction.count!,
          users: reaction.users || [],
        })),
        files: message.files?.map(file => ({
          id: file.id!,
          name: file.name!,
          mimetype: file.mimetype!,
          url: file.url_private!,
          size: file.size!,
        })),
      })) || [];
    } catch (error) {
      this.logger.error(`Failed to fetch thread replies for ${threadTs}`, error);
      throw error;
    }
  }

  async getUserInfo(userId: string): Promise<SlackUser | null> {
    try {
      const result = await this.slackClient.users.info({
        user: userId,
      });

      if (!result.user) {
        return null;
      }

      return {
        id: result.user.id!,
        name: result.user.name!,
        realName: result.user.real_name!,
        email: result.user.profile?.email,
        isBot: result.user.is_bot || false,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user info for ${userId}`, error);
      return null;
    }
  }

  async getMessagesWithReaction(
    channelId: string,
    reactionName: string,
    oldest?: string,
  ): Promise<SlackMessage[]> {
    const messages = await this.getChannelHistory(channelId, oldest);
    
    return messages.filter(message => 
      message.reactions?.some(reaction => reaction.name === reactionName)
    );
  }

  async getMessagesWithKeywords(
    channelId: string,
    keywords: string[],
    oldest?: string,
  ): Promise<SlackMessage[]> {
    const messages = await this.getChannelHistory(channelId, oldest);
    
    return messages.filter(message => 
      keywords.some(keyword => 
        message.text.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
} 
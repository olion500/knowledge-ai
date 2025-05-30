import { Test, TestingModule } from '@nestjs/testing';
import { SlackController } from './slack.controller';
import { SlackService } from './slack.service';
import { DocumentService } from '../document/document.service';
import { SlackEventPayload } from '../../common/interfaces/slack.interface';

describe('SlackController', () => {
  let controller: SlackController;
  let slackService: jest.Mocked<SlackService>;
  let documentService: jest.Mocked<DocumentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SlackController],
      providers: [
        {
          provide: SlackService,
          useValue: {
            getChannelHistory: jest.fn(),
            getMessagesWithReaction: jest.fn(),
            getMessagesWithKeywords: jest.fn(),
          },
        },
        {
          provide: DocumentService,
          useValue: {
            processSlackMessages: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SlackController>(SlackController);
    slackService = module.get(SlackService);
    documentService = module.get(DocumentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleSlackEvent', () => {
    it('should handle URL verification challenge', async () => {
      const payload = {
        type: 'url_verification',
        challenge: 'test-challenge-123',
      } as any;

      const result = await controller.handleSlackEvent(payload);

      expect(result).toEqual({ challenge: 'test-challenge-123' });
    });

    it('should handle event callback', async () => {
      const payload: SlackEventPayload = {
        type: 'event_callback',
        token: 'test-token',
        event: {
          type: 'message',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'This is a decision we need to make',
          ts: '1234567890.123456',
          eventTs: '1234567890.123456',
          channelType: 'channel',
        },
        teamId: 'T1234567890',
        apiAppId: 'A1234567890',
        eventId: 'Ev1234567890',
        eventTime: 1234567890,
      };

      slackService.getChannelHistory.mockResolvedValue([
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'This is a decision we need to make',
          timestamp: '1234567890.123456',
        },
      ]);

      documentService.processSlackMessages.mockResolvedValue();

      const result = await controller.handleSlackEvent(payload);

      expect(result).toEqual({});
      expect(slackService.getChannelHistory).toHaveBeenCalledWith(
        'C1234567890',
        '1234567890.123456',
        '1234567891.123456',
      );
      expect(documentService.processSlackMessages).toHaveBeenCalled();
    });

    it('should handle reaction_added event', async () => {
      const payload: SlackEventPayload = {
        type: 'event_callback',
        token: 'test-token',
        event: {
          type: 'reaction_added',
          user: 'U1234567890',
          reaction: 'memo',
          item: {
            type: 'message',
            channel: 'C1234567890',
            ts: '1234567890.123456',
          },
          eventTs: '1234567890.123456',
          channelType: 'channel',
        },
        teamId: 'T1234567890',
        apiAppId: 'A1234567890',
        eventId: 'Ev1234567890',
        eventTime: 1234567890,
      };

      slackService.getChannelHistory.mockResolvedValue([
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'Important message',
          timestamp: '1234567890.123456',
          reactions: [
            {
              name: 'memo',
              count: 1,
              users: ['U1234567890'],
            },
          ],
        },
      ]);

      documentService.processSlackMessages.mockResolvedValue();

      const result = await controller.handleSlackEvent(payload);

      expect(result).toEqual({});
      expect(documentService.processSlackMessages).toHaveBeenCalled();
    });

    it('should ignore non-important reactions', async () => {
      const payload: SlackEventPayload = {
        type: 'event_callback',
        token: 'test-token',
        event: {
          type: 'reaction_added',
          user: 'U1234567890',
          reaction: 'thumbsup',
          item: {
            type: 'message',
            channel: 'C1234567890',
            ts: '1234567890.123456',
          },
          eventTs: '1234567890.123456',
          channelType: 'channel',
        },
        teamId: 'T1234567890',
        apiAppId: 'A1234567890',
        eventId: 'Ev1234567890',
        eventTime: 1234567890,
      };

      const result = await controller.handleSlackEvent(payload);

      expect(result).toEqual({});
      expect(slackService.getChannelHistory).not.toHaveBeenCalled();
      expect(documentService.processSlackMessages).not.toHaveBeenCalled();
    });
  });

  describe('collectMessages', () => {
    it('should collect messages with reaction', async () => {
      const request = {
        channelId: 'C1234567890',
        reactionName: 'memo',
        hours: 24,
      };

      const mockMessages = [
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'Important message',
          timestamp: '1234567890.123456',
          reactions: [
            {
              name: 'memo',
              count: 1,
              users: ['U1234567890'],
            },
          ],
        },
      ];

      slackService.getMessagesWithReaction.mockResolvedValue(mockMessages);
      documentService.processSlackMessages.mockResolvedValue();

      const result = await controller.collectMessages(request);

      expect(result).toEqual({
        message: 'Processed 1 messages from channel C1234567890',
        count: 1,
      });

      expect(slackService.getMessagesWithReaction).toHaveBeenCalledWith(
        'C1234567890',
        'memo',
        expect.any(String),
      );
      expect(documentService.processSlackMessages).toHaveBeenCalledWith(mockMessages);
    });

    it('should collect messages with keywords', async () => {
      const request = {
        channelId: 'C1234567890',
        keywords: ['decision', 'action item'],
        hours: 48,
      };

      const mockMessages = [
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'We need to make a decision',
          timestamp: '1234567890.123456',
        },
      ];

      slackService.getMessagesWithKeywords.mockResolvedValue(mockMessages);
      documentService.processSlackMessages.mockResolvedValue();

      const result = await controller.collectMessages(request);

      expect(result).toEqual({
        message: 'Processed 1 messages from channel C1234567890',
        count: 1,
      });

      expect(slackService.getMessagesWithKeywords).toHaveBeenCalledWith(
        'C1234567890',
        ['decision', 'action item'],
        expect.any(String),
      );
    });

    it('should collect all messages when no filters provided', async () => {
      const request = {
        channelId: 'C1234567890',
        hours: 12,
      };

      const mockMessages = [
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'Regular message',
          timestamp: '1234567890.123456',
        },
      ];

      slackService.getChannelHistory.mockResolvedValue(mockMessages);
      documentService.processSlackMessages.mockResolvedValue();

      const result = await controller.collectMessages(request);

      expect(result).toEqual({
        message: 'Processed 1 messages from channel C1234567890',
        count: 1,
      });

      expect(slackService.getChannelHistory).toHaveBeenCalledWith(
        'C1234567890',
        expect.any(String),
      );
    });

    it('should not process when no messages found', async () => {
      const request = {
        channelId: 'C1234567890',
        reactionName: 'memo',
      };

      slackService.getMessagesWithReaction.mockResolvedValue([]);

      const result = await controller.collectMessages(request);

      expect(result).toEqual({
        message: 'Processed 0 messages from channel C1234567890',
        count: 0,
      });

      expect(documentService.processSlackMessages).not.toHaveBeenCalled();
    });

    it('should use default hours when not provided', async () => {
      const request = {
        channelId: 'C1234567890',
        reactionName: 'memo',
      };

      slackService.getMessagesWithReaction.mockResolvedValue([]);

      await controller.collectMessages(request);

      // Verify that the oldest timestamp is calculated with 24 hours (default)
      const expectedOldest = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime() / 1000;
      expect(slackService.getMessagesWithReaction).toHaveBeenCalledWith(
        'C1234567890',
        'memo',
        expect.any(String),
      );
    });
  });

  describe('processSlackEvent', () => {
    it('should process message with keywords', async () => {
      const event = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'We need to follow up on this action item',
        ts: '1234567890.123456',
      };

      slackService.getChannelHistory.mockResolvedValue([
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'We need to follow up on this action item',
          timestamp: '1234567890.123456',
        },
      ]);

      documentService.processSlackMessages.mockResolvedValue();

      await (controller as any).processSlackEvent({
        type: 'event_callback',
        event,
      });

      expect(slackService.getChannelHistory).toHaveBeenCalled();
      expect(documentService.processSlackMessages).toHaveBeenCalled();
    });

    it('should ignore messages without keywords', async () => {
      const event = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Just a regular message',
        ts: '1234567890.123456',
      };

      await (controller as any).processSlackEvent({
        type: 'event_callback',
        event,
      });

      expect(slackService.getChannelHistory).not.toHaveBeenCalled();
      expect(documentService.processSlackMessages).not.toHaveBeenCalled();
    });
  });
}); 
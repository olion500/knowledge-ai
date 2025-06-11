import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { GitHubWebhookService } from '../services/github-webhook.service';
import { ConfigService } from '@nestjs/config';

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: GitHubWebhookService;
  let configService: ConfigService;

  const mockWebhookService = {
    handlePushEvent: jest.fn(),
    handlePullRequestEvent: jest.fn(),
    validateWebhookSignature: jest.fn(),
    processPendingEvents: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: GitHubWebhookService,
          useValue: mockWebhookService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get<GitHubWebhookService>(GitHubWebhookService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleGitHubWebhook', () => {
    const mockHeaders = {
      'x-github-event': 'push',
      'x-hub-signature-256': 'sha256=valid_signature',
    };

    const mockPayload = {
      repository: { full_name: 'owner/repo' },
      commits: [{ id: 'abc123' }],
    };

    it('should handle push events successfully', async () => {
      mockConfigService.get.mockReturnValue('webhook-secret');
      mockWebhookService.validateWebhookSignature.mockReturnValue(true);
      mockWebhookService.handlePushEvent.mockResolvedValue(undefined);

      const result = await controller.handleGitHubWebhook(mockHeaders, mockPayload);

      expect(mockWebhookService.validateWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(mockPayload),
        'sha256=valid_signature',
        'webhook-secret',
      );
      expect(mockWebhookService.handlePushEvent).toHaveBeenCalledWith(mockPayload);
      expect(result).toEqual({ status: 'success', event: 'push' });
    });

    it('should reject invalid signatures', async () => {
      mockConfigService.get.mockReturnValue('webhook-secret');
      mockWebhookService.validateWebhookSignature.mockReturnValue(false);

      await expect(
        controller.handleGitHubWebhook(mockHeaders, mockPayload)
      ).rejects.toThrow(BadRequestException);

      expect(mockWebhookService.handlePushEvent).not.toHaveBeenCalled();
    });

    it('should ignore non-push events', async () => {
      const nonPushHeaders = { ...mockHeaders, 'x-github-event': 'issues' };
      mockConfigService.get.mockReturnValue('webhook-secret');
      mockWebhookService.validateWebhookSignature.mockReturnValue(true);

      const result = await controller.handleGitHubWebhook(nonPushHeaders, mockPayload);

      expect(mockWebhookService.handlePushEvent).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'ignored', event: 'issues' });
    });

    it('should handle missing webhook secret gracefully', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        controller.handleGitHubWebhook(mockHeaders, mockPayload)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle missing signature header', async () => {
      const headersWithoutSignature = { 'x-github-event': 'push' };
      mockConfigService.get.mockReturnValue('webhook-secret');

      await expect(
        controller.handleGitHubWebhook(headersWithoutSignature, mockPayload)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('webhook-secret');
      mockWebhookService.validateWebhookSignature.mockReturnValue(true);
      mockWebhookService.handlePushEvent.mockRejectedValue(new Error('Service error'));

      await expect(
        controller.handleGitHubWebhook(mockHeaders, mockPayload)
      ).rejects.toThrow('Service error');
    });

    it('should handle pull request events successfully', async () => {
      const prHeaders = { ...mockHeaders, 'x-github-event': 'pull_request' };
      const prPayload = {
        action: 'opened',
        repository: { full_name: 'owner/repo' },
        pull_request: { number: 123, head: { sha: 'abc123' } },
      };

      mockConfigService.get.mockReturnValue('webhook-secret');
      mockWebhookService.validateWebhookSignature.mockReturnValue(true);
      mockWebhookService.handlePullRequestEvent.mockResolvedValue(undefined);

      const result = await controller.handleGitHubWebhook(prHeaders, prPayload);

      expect(mockWebhookService.validateWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(prPayload),
        'sha256=valid_signature',
        'webhook-secret',
      );
      expect(mockWebhookService.handlePullRequestEvent).toHaveBeenCalledWith(prPayload);
      expect(result).toEqual({ status: 'success', event: 'pull_request' });
    });
  });

  describe('processPendingEvents', () => {
    it('should process pending events successfully', async () => {
      mockWebhookService.processPendingEvents.mockResolvedValue(undefined);

      const result = await controller.processPendingEvents();

      expect(mockWebhookService.processPendingEvents).toHaveBeenCalled();
      expect(result).toEqual({ status: 'success', message: 'Pending events processed' });
    });

    it('should handle processing errors', async () => {
      mockWebhookService.processPendingEvents.mockRejectedValue(new Error('Processing failed'));

      await expect(controller.processPendingEvents()).rejects.toThrow('Processing failed');
    });
  });

  describe('getWebhookStatus', () => {
    it('should return webhook status', async () => {
      const result = await controller.getWebhookStatus();

      expect(result).toEqual({
        status: 'active',
        endpoint: '/api/webhooks/github',
        supportedEvents: ['push', 'pull_request'],
      });
    });
  });
}); 
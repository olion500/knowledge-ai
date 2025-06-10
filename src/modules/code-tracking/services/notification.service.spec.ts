import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
// Mock SlackService since it might not exist yet
class MockSlackService {
  sendMessage = jest.fn();
  sendCodeChangeNotification = jest.fn();
}
import { NotificationPayload } from '../../../common/interfaces/code-tracking.interface';

describe('NotificationService', () => {
  let service: NotificationService;
  let slackService: MockSlackService;

  const mockSlackService = {
    sendMessage: jest.fn(),
    sendCodeChangeNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: 'SlackService',
          useValue: mockSlackService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    slackService = module.get<MockSlackService>('SlackService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendChangeNotification', () => {
    it('should send notification for code change', async () => {
      const payload: NotificationPayload = {
        documentId: 'doc1',
        referenceId: 'ref1',
        changeType: 'modified',
        oldContent: 'old code',
        newContent: 'new code',
      };

      mockSlackService.sendCodeChangeNotification.mockResolvedValue({ ok: true });

      await service.sendChangeNotification(payload);

      expect(mockSlackService.sendCodeChangeNotification).toHaveBeenCalledWith({
        type: 'code_change',
        referenceId: 'ref1',
        documentId: 'doc1',
        changeType: 'modified',
        oldContent: 'old code',
        newContent: 'new code',
        message: expect.stringContaining('Code reference ref1 has been modified'),
      });
    });

    it('should handle notification failure gracefully', async () => {
      const payload: NotificationPayload = {
        documentId: 'doc1',
        referenceId: 'ref1',
        changeType: 'modified',
        oldContent: 'old code',
        newContent: 'new code',
      };

      mockSlackService.sendCodeChangeNotification.mockRejectedValue(new Error('Slack error'));

      // Should not throw
      await expect(service.sendChangeNotification(payload)).resolves.toBeUndefined();
    });
  });

  describe('sendConflictNotification', () => {
    it('should send notification for code conflict', async () => {
      const payload: NotificationPayload = {
        documentId: 'doc1',
        referenceId: 'ref1',
        changeType: 'deleted',
        oldContent: 'deleted code',
        conflictResolution: {
          referenceId: 'ref1',
          conflictType: 'deleted',
          resolution: 'manual',
        },
      };

      mockSlackService.sendCodeChangeNotification.mockResolvedValue({ ok: true });

      await service.sendConflictNotification(payload);

      expect(mockSlackService.sendCodeChangeNotification).toHaveBeenCalledWith({
        type: 'conflict',
        referenceId: 'ref1',
        documentId: 'doc1',
        changeType: 'deleted',
        oldContent: 'deleted code',
        conflictType: 'deleted',
        resolution: 'manual',
        message: expect.stringContaining('Code conflict detected for reference ref1'),
      });
    });

    it('should include conflict resolution details', async () => {
      const payload: NotificationPayload = {
        documentId: 'doc1',
        referenceId: 'ref1',
        changeType: 'moved',
        oldContent: 'moved code',
        conflictResolution: {
          referenceId: 'ref1',
          conflictType: 'moved',
          resolution: 'update',
          newContent: 'updated code',
          newStartLine: 10,
          newEndLine: 15,
        },
      };

      mockSlackService.sendCodeChangeNotification.mockResolvedValue({ ok: true });

      await service.sendConflictNotification(payload);

      expect(mockSlackService.sendCodeChangeNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conflict',
          resolution: 'update',
          newContent: 'updated code',
          newStartLine: 10,
          newEndLine: 15,
        }),
      );
    });
  });

  describe('formatChangeMessage', () => {
    it('should format message for modified code', () => {
      const message = service.formatChangeMessage('ref1', 'modified', 'old', 'new');
      expect(message).toContain('Code reference ref1 has been modified');
      expect(message).toContain('Old content:');
      expect(message).toContain('New content:');
    });

    it('should format message for deleted code', () => {
      const message = service.formatChangeMessage('ref1', 'deleted', 'deleted content');
      expect(message).toContain('Code reference ref1 has been deleted');
      expect(message).toContain('Original content:');
    });

    it('should truncate long content', () => {
      const longContent = 'a'.repeat(300);
      const message = service.formatChangeMessage('ref1', 'modified', longContent, 'new');
      expect(message).toContain('...');
      expect(message.length).toBeLessThan(1000);
    });
  });

  describe('formatConflictMessage', () => {
    it('should format message for conflict with manual resolution', () => {
      const message = service.formatConflictMessage('ref1', 'deleted', 'manual');
      expect(message).toContain('Code conflict detected for reference ref1');
      expect(message).toContain('Conflict type: deleted');
      expect(message).toContain('Resolution required: Manual intervention needed');
    });

    it('should format message for conflict with auto resolution', () => {
      const message = service.formatConflictMessage('ref1', 'moved', 'auto');
      expect(message).toContain('Resolution required: Automatically resolved');
    });
  });

  describe('sendBulkNotifications', () => {
    it('should send multiple notifications in batch', async () => {
      const payloads: NotificationPayload[] = [
        {
          documentId: 'doc1',
          referenceId: 'ref1',
          changeType: 'modified',
          oldContent: 'old1',
          newContent: 'new1',
        },
        {
          documentId: 'doc2',
          referenceId: 'ref2',
          changeType: 'deleted',
          oldContent: 'old2',
        },
      ];

      mockSlackService.sendCodeChangeNotification.mockResolvedValue({ ok: true });

      await service.sendBulkNotifications(payloads);

      expect(mockSlackService.sendCodeChangeNotification).toHaveBeenCalledTimes(2);
    });

    it('should continue processing if one notification fails', async () => {
      const payloads: NotificationPayload[] = [
        {
          documentId: 'doc1',
          referenceId: 'ref1',
          changeType: 'modified',
          oldContent: 'old1',
          newContent: 'new1',
        },
        {
          documentId: 'doc2',
          referenceId: 'ref2',
          changeType: 'modified',
          oldContent: 'old2',
          newContent: 'new2',
        },
      ];

      mockSlackService.sendCodeChangeNotification
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({ ok: true });

      await service.sendBulkNotifications(payloads);

      expect(mockSlackService.sendCodeChangeNotification).toHaveBeenCalledTimes(2);
    });
  });
}); 
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GitHubWebhookService } from './github-webhook.service';
import {
  CodeChangeEvent,
  ChangeType,
} from '../../../common/entities/code-change-event.entity';
import { CodeReference } from '../../../common/entities/code-reference.entity';
import { SmartCodeTrackingService } from './smart-code-tracking.service';

describe('GitHubWebhookService', () => {
  let service: GitHubWebhookService;
  let codeChangeEventRepository: Repository<CodeChangeEvent>;
  let codeReferenceRepository: Repository<CodeReference>;
  let smartTrackingService: SmartCodeTrackingService;

  const mockCodeChangeEventRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCodeReferenceRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockSmartTrackingService = {
    processCodeChange: jest.fn(),
    detectFunctionChanges: jest.fn(),
    detectLineMovements: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubWebhookService,
        {
          provide: getRepositoryToken(CodeChangeEvent),
          useValue: mockCodeChangeEventRepository,
        },
        {
          provide: getRepositoryToken(CodeReference),
          useValue: mockCodeReferenceRepository,
        },
        {
          provide: SmartCodeTrackingService,
          useValue: mockSmartTrackingService,
        },
      ],
    }).compile();

    service = module.get<GitHubWebhookService>(GitHubWebhookService);
    codeChangeEventRepository = module.get<Repository<CodeChangeEvent>>(
      getRepositoryToken(CodeChangeEvent),
    );
    codeReferenceRepository = module.get<Repository<CodeReference>>(
      getRepositoryToken(CodeReference),
    );
    smartTrackingService = module.get<SmartCodeTrackingService>(
      SmartCodeTrackingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePushEvent', () => {
    const mockPushPayload = {
      repository: {
        full_name: 'owner/repo',
      },
      commits: [
        {
          id: 'abc123',
          timestamp: '2024-01-01T00:00:00Z',
          added: ['new-file.ts'],
          removed: ['old-file.ts'],
          modified: ['modified-file.ts'],
        },
      ],
    };

    it('should process push event and create change events', async () => {
      mockCodeReferenceRepository.find.mockResolvedValue([
        { id: 'ref1', filePath: 'new-file.ts' },
        { id: 'ref2', filePath: 'old-file.ts' },
        { id: 'ref3', filePath: 'modified-file.ts' },
      ]);
      mockCodeChangeEventRepository.create.mockReturnValue({});
      mockCodeChangeEventRepository.save.mockResolvedValue({});

      await service.handlePushEvent(mockPushPayload);

      expect(mockCodeReferenceRepository.find).toHaveBeenCalledWith({
        where: {
          repositoryOwner: 'owner',
          repositoryName: 'repo',
        },
      });
      expect(mockCodeChangeEventRepository.create).toHaveBeenCalledTimes(3); // added, removed, modified
      expect(mockCodeChangeEventRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle empty commits array', async () => {
      const emptyPayload = {
        repository: { full_name: 'owner/repo' },
        commits: [],
      };

      await service.handlePushEvent(emptyPayload);

      expect(mockCodeChangeEventRepository.create).not.toHaveBeenCalled();
      expect(mockCodeChangeEventRepository.save).not.toHaveBeenCalled();
    });

    it('should filter affected references correctly', async () => {
      const references = [
        { id: 'ref1', filePath: 'modified-file.ts' },
        { id: 'ref2', filePath: 'unrelated-file.ts' },
      ];
      mockCodeReferenceRepository.find.mockResolvedValue(references);
      mockCodeChangeEventRepository.create.mockReturnValue({});
      mockCodeChangeEventRepository.save.mockResolvedValue({});

      await service.handlePushEvent(mockPushPayload);

      // Should only affect ref1 since it matches modified-file.ts
      expect(mockCodeChangeEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          affectedReferences: ['ref1'],
        }),
      );
    });
  });

  describe('processChangeEvent', () => {
    it('should process a change event successfully', async () => {
      const changeEvent = new CodeChangeEvent();
      changeEvent.id = 'event1';
      changeEvent.changeType = ChangeType.MODIFIED;
      changeEvent.markAsProcessing = jest.fn();
      changeEvent.markAsCompleted = jest.fn();
      changeEvent.markAsFailed = jest.fn();

      mockSmartTrackingService.processCodeChange.mockResolvedValue(true);
      mockCodeChangeEventRepository.save.mockResolvedValue(changeEvent);

      await service.processChangeEvent(changeEvent);

      expect(changeEvent.markAsProcessing).toHaveBeenCalled();
      expect(mockSmartTrackingService.processCodeChange).toHaveBeenCalledWith(
        changeEvent,
      );
      expect(changeEvent.markAsCompleted).toHaveBeenCalled();
      expect(mockCodeChangeEventRepository.save).toHaveBeenCalledTimes(2); // processing + completed
    });

    it('should handle processing failure', async () => {
      const changeEvent = new CodeChangeEvent();
      changeEvent.id = 'event1';
      changeEvent.markAsProcessing = jest.fn();
      changeEvent.markAsCompleted = jest.fn();
      changeEvent.markAsFailed = jest.fn();

      const error = new Error('Processing failed');
      mockSmartTrackingService.processCodeChange.mockRejectedValue(error);
      mockCodeChangeEventRepository.save.mockResolvedValue(changeEvent);

      await service.processChangeEvent(changeEvent);

      expect(changeEvent.markAsProcessing).toHaveBeenCalled();
      expect(changeEvent.markAsFailed).toHaveBeenCalledWith(
        'Processing failed',
      );
      expect(changeEvent.markAsCompleted).not.toHaveBeenCalled();
    });
  });

  describe('findAffectedReferences', () => {
    it('should find references for given repository and file paths', async () => {
      const references = [
        { id: 'ref1', filePath: 'file1.ts' },
        { id: 'ref2', filePath: 'file2.ts' },
      ];
      mockCodeReferenceRepository.find.mockResolvedValue(references);

      const result = await service.findAffectedReferences('owner/repo', [
        'file1.ts',
        'file3.ts',
      ]);

      expect(mockCodeReferenceRepository.find).toHaveBeenCalledWith({
        where: {
          repositoryOwner: 'owner',
          repositoryName: 'repo',
        },
      });
      expect(result).toEqual(['ref1']); // Only ref1 matches file1.ts
    });

    it('should return empty array when no references found', async () => {
      mockCodeReferenceRepository.find.mockResolvedValue([]);

      const result = await service.findAffectedReferences('owner/repo', [
        'file1.ts',
      ]);

      expect(result).toEqual([]);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct signature', () => {
      const payload = 'test payload';
      const secret = 'webhook-secret';
      const signature =
        'sha256=' +
        require('crypto')
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');

      const result = service.validateWebhookSignature(
        payload,
        signature,
        secret,
      );

      expect(result).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const payload = 'test payload';
      const secret = 'webhook-secret';
      const wrongSignature = 'sha256=wrongsignature';

      const result = service.validateWebhookSignature(
        payload,
        wrongSignature,
        secret,
      );

      expect(result).toBe(false);
    });

    it('should handle missing signature gracefully', () => {
      const payload = 'test payload';
      const secret = 'webhook-secret';

      const result = service.validateWebhookSignature(payload, '', secret);

      expect(result).toBe(false);
    });
  });

  describe('getPendingEvents', () => {
    it('should return pending events', async () => {
      const pendingEvents = [
        { id: 'event1', processingStatus: 'pending' },
        { id: 'event2', processingStatus: 'pending' },
      ];
      mockCodeChangeEventRepository.find.mockResolvedValue(pendingEvents);

      const result = await service.getPendingEvents();

      expect(mockCodeChangeEventRepository.find).toHaveBeenCalledWith({
        where: { processingStatus: 'pending' },
        order: { timestamp: 'ASC' },
        take: 50,
      });
      expect(result).toEqual(pendingEvents);
    });
  });

  describe('processPendingEvents', () => {
    it('should process all pending events', async () => {
      const pendingEvents = [
        { id: 'event1', isProcessable: () => true },
        { id: 'event2', isProcessable: () => true },
      ];
      mockCodeChangeEventRepository.find.mockResolvedValue(pendingEvents);
      jest.spyOn(service, 'processChangeEvent').mockResolvedValue();

      await service.processPendingEvents();

      expect(service.processChangeEvent).toHaveBeenCalledTimes(2);
      expect(service.processChangeEvent).toHaveBeenCalledWith(pendingEvents[0]);
      expect(service.processChangeEvent).toHaveBeenCalledWith(pendingEvents[1]);
    });

    it('should skip non-processable events', async () => {
      const events = [
        { id: 'event1', isProcessable: () => true },
        { id: 'event2', isProcessable: () => false },
      ];
      mockCodeChangeEventRepository.find.mockResolvedValue(events);
      jest.spyOn(service, 'processChangeEvent').mockResolvedValue();

      await service.processPendingEvents();

      expect(service.processChangeEvent).toHaveBeenCalledTimes(1);
      expect(service.processChangeEvent).toHaveBeenCalledWith(events[0]);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SyncService } from '../sync.service';
import { Repository } from '../../../common/entities/repository.entity';
import { SyncJob } from '../../../common/entities/sync-job.entity';
import { DocumentationUpdate } from '../../../common/entities/documentation-update.entity';
import { RepositoryService } from '../../repository/repository.service';
import { CodeAnalysisService } from '../../code-analysis/code-analysis.service';
import { CodeAnalysisLLMService } from '../../code-analysis/services/code-analysis-llm.service';
import { GitHubService } from '../../github/github.service';

describe('SyncService', () => {
  let service: SyncService;
  let repositoryService: jest.Mocked<RepositoryService>;
  let codeAnalysisService: jest.Mocked<CodeAnalysisService>;
  let codeAnalysisLLMService: jest.Mocked<CodeAnalysisLLMService>;
  let githubService: jest.Mocked<GitHubService>;
  let repositoryRepository: jest.Mocked<any>;
  let syncJobRepository: jest.Mocked<any>;
  let documentationUpdateRepository: jest.Mocked<any>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;
  let configService: jest.Mocked<ConfigService>;

  const mockRepository: Partial<Repository> = {
    id: 'repo-123',
    owner: 'testowner',
    name: 'testrepo',
    fullName: 'testowner/testrepo',
    description: 'Test repository',
    language: 'TypeScript',
    defaultBranch: 'main',
    active: true,
    isPrivate: false,
    syncConfig: {
      enabled: true,
      branch: 'main',
      syncFrequency: 'daily',
      autoDocGeneration: true,
    },
    lastSyncedAt: new Date('2024-01-01T00:00:00Z'),
    lastCommitSha: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSyncJob: Partial<SyncJob> = {
    id: 'sync-job-123',
    repositoryId: 'repo-123',
    type: 'manual',
    status: 'pending',
    startedAt: new Date(),
    retryCount: 0,
    maxRetries: 3,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    updateStatus: jest.fn(),
    incrementRetry: jest.fn(),
    canRetry: true,
  };

  const mockCommits = [
    {
      sha: 'def456',
      commit: {
        message: 'Add new feature',
        author: { name: 'Test Author', date: '2024-01-02T00:00:00Z' },
      },
    },
  ];

  const mockCodeChanges = {
    added: [
      {
        id: 'code-1',
        functionName: 'newFunction',
        signature: 'newFunction(): void',
        filePath: 'src/new.ts',
        fingerprint: 'finger1',
      },
    ],
    modified: [],
    deleted: [],
  };

  const mockLLMAnalysisResult = {
    shouldUpdate: true,
    confidence: 85,
    reasoning: 'Significant API changes detected',
    suggestedUpdates: {
      readme: {
        shouldUpdate: true,
        sections: ['API'],
        priority: 'high' as const,
        suggestedContent: 'Update API section',
      },
      changelog: {
        shouldUpdate: true,
        entryType: 'minor' as const,
        priority: 'medium' as const,
        suggestedEntry: 'Added new feature',
      },
    },
    metadata: {
      analysisDate: '2024-01-02T00:00:00Z',
      llmModel: 'gpt-4',
      processingTime: 1500,
    },
  };

  beforeEach(async () => {
    const mockRepositoryService = {
      findById: jest.fn(),
      findActiveRepositories: jest.fn(),
      getCommitsSince: jest.fn(),
      updateLastSync: jest.fn(),
    };

    const mockCodeAnalysisService = {
      analyzeRepository: jest.fn(),
      compareCommits: jest.fn(),
    };

    const mockCodeAnalysisLLMService = {
      analyzeCodeChangesForDocumentation: jest.fn(),
    };

    const mockGitHubService = {
      getCommits: jest.fn(),
      getRepositoryInfo: jest.fn(),
      getFileContent: jest.fn(),
      getRepositoryContents: jest.fn(),
    };

    const mockRepositoryRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockSyncJobRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    const mockDocumentationUpdateRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockSchedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      getCronJob: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          SYNC_ENABLED: true,
          SYNC_CRON: '0 6 * * *',
          SYNC_RETRY_ATTEMPTS: 3,
          SYNC_RETRY_DELAY: 600000,
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
        {
          provide: CodeAnalysisService,
          useValue: mockCodeAnalysisService,
        },
        {
          provide: CodeAnalysisLLMService,
          useValue: mockCodeAnalysisLLMService,
        },
        {
          provide: GitHubService,
          useValue: mockGitHubService,
        },
        {
          provide: getRepositoryToken(Repository),
          useValue: mockRepositoryRepository,
        },
        {
          provide: getRepositoryToken(SyncJob),
          useValue: mockSyncJobRepository,
        },
        {
          provide: getRepositoryToken(DocumentationUpdate),
          useValue: mockDocumentationUpdateRepository,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
    repositoryService = module.get(RepositoryService);
    codeAnalysisService = module.get(CodeAnalysisService);
    codeAnalysisLLMService = module.get(CodeAnalysisLLMService);
    githubService = module.get(GitHubService);
    repositoryRepository = module.get(getRepositoryToken(Repository));
    syncJobRepository = module.get(getRepositoryToken(SyncJob));
    documentationUpdateRepository = module.get(
      getRepositoryToken(DocumentationUpdate),
    );
    schedulerRegistry = module.get(SchedulerRegistry);
    configService = module.get(ConfigService);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Sync Repository', () => {
    beforeEach(() => {
      repositoryRepository.findOne.mockResolvedValue(
        mockRepository as Repository,
      );
      syncJobRepository.create.mockReturnValue(mockSyncJob as SyncJob);
      syncJobRepository.save.mockResolvedValue(mockSyncJob as SyncJob);
      // Reset findOne to return null (no existing running job) first, then return the job
      syncJobRepository.findOne.mockImplementation((query) => {
        if (query.where?.status === 'running') {
          return Promise.resolve(null); // No existing running job
        }
        return Promise.resolve({
          ...mockSyncJob,
          repository: mockRepository,
        } as SyncJob);
      });
      codeAnalysisService.analyzeRepository.mockResolvedValue({
        totalFiles: 10,
        analyzedFiles: 8,
        functions: 15,
        classes: 3,
        errors: [],
      });
      githubService.getCommits.mockResolvedValue(mockCommits);
    });

    it('should create sync job and execute sync', async () => {
      const result = await service.syncRepository('repo-123');

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(syncJobRepository.create).toHaveBeenCalledWith({
        repositoryId: 'repo-123',
        type: 'manual',
        status: 'pending',
        metadata: {},
      });
    });

    it('should handle repository not found', async () => {
      repositoryRepository.findOne.mockResolvedValue(null);

      await expect(service.syncRepository('nonexistent-repo')).rejects.toThrow(
        'Repository nonexistent-repo not found',
      );
    });

    it('should handle existing running job', async () => {
      syncJobRepository.findOne.mockResolvedValue(mockSyncJob as SyncJob);

      await expect(service.syncRepository('repo-123')).rejects.toThrow(
        'Sync job already running for repository repo-123',
      );
    });
  });

  describe('Sync Job Management', () => {
    describe('createSyncJob', () => {
      it('should create and save sync job', async () => {
        repositoryRepository.findOne.mockResolvedValue(
          mockRepository as Repository,
        );
        syncJobRepository.findOne.mockResolvedValue(null); // No existing job
        syncJobRepository.create.mockReturnValue(mockSyncJob as SyncJob);
        syncJobRepository.save.mockResolvedValue(mockSyncJob as SyncJob);

        const jobId = await service.createSyncJob('repo-123', 'manual');

        expect(jobId).toBe('sync-job-123');
        expect(syncJobRepository.create).toHaveBeenCalledWith({
          repositoryId: 'repo-123',
          type: 'manual',
          status: 'pending',
          metadata: {},
        });
        expect(syncJobRepository.save).toHaveBeenCalledWith(
          mockSyncJob as SyncJob,
        );
      });
    });

    describe('getSyncJob', () => {
      it('should get sync job by id', async () => {
        syncJobRepository.findOne.mockResolvedValue(mockSyncJob as SyncJob);

        const job = await service.getSyncJob('sync-job-123');

        expect(job).toEqual(mockSyncJob);
        expect(syncJobRepository.findOne).toHaveBeenCalledWith({
          where: { id: 'sync-job-123' },
          relations: ['repository'],
        });
      });
    });

    describe('getSyncJobs', () => {
      it('should get sync jobs for repository', async () => {
        syncJobRepository.find.mockResolvedValue([mockSyncJob as SyncJob]);

        const jobs = await service.getSyncJobs('repo-123');

        expect(jobs).toEqual([mockSyncJob]);
        expect(syncJobRepository.find).toHaveBeenCalledWith({
          where: { repositoryId: 'repo-123' },
          order: { createdAt: 'DESC' },
          relations: ['repository'],
          take: 10,
        });
      });
    });

    describe('getSyncProgress', () => {
      it('should get sync progress', () => {
        const progress = service.getSyncProgress('sync-job-123');
        expect(progress).toBeNull(); // No active job initially
      });
    });
  });

  describe('Documentation Updates', () => {
    it('should get pending documentation updates', async () => {
      const mockUpdates = [
        {
          id: 'doc-1',
          repositoryId: 'repo-123',
          status: 'pending',
          priority: 'high',
        },
      ];
      documentationUpdateRepository.find.mockResolvedValue(mockUpdates);

      const updates = await service.getPendingDocumentationUpdates();

      expect(updates).toEqual(mockUpdates);
      expect(documentationUpdateRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending' },
        order: { priority: 'DESC', confidence: 'DESC', createdAt: 'ASC' },
        relations: ['repository', 'syncJob'],
        take: 50,
      });
    });

    it('should get pending documentation updates for specific repository', async () => {
      const mockUpdates = [
        {
          id: 'doc-1',
          repositoryId: 'repo-123',
          status: 'pending',
          priority: 'high',
        },
      ];
      documentationUpdateRepository.find.mockResolvedValue(mockUpdates);

      const updates = await service.getPendingDocumentationUpdates('repo-123');

      expect(updates).toEqual(mockUpdates);
      expect(documentationUpdateRepository.find).toHaveBeenCalledWith({
        where: { status: 'pending', repositoryId: 'repo-123' },
        order: { priority: 'DESC', confidence: 'DESC', createdAt: 'ASC' },
        relations: ['repository', 'syncJob'],
        take: 50,
      });
    });
  });
});

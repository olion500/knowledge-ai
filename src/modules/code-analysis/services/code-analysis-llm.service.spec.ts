import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CodeAnalysisLLMService } from './code-analysis-llm.service';
import { LLMService } from '../../llm/llm.service';
import { Repository } from '../../../common/entities/repository.entity';
import { CodeStructure } from '../../../common/entities/code-structure.entity';
import { DocumentationUpdateResponse } from '../../../common/interfaces/code-analysis-llm.interface';

describe('CodeAnalysisLLMService', () => {
  let service: CodeAnalysisLLMService;
  let llmService: jest.Mocked<LLMService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRepository: Repository = {
    id: 'repo-123',
    owner: 'testowner',
    name: 'testrepo',
    fullName: 'testowner/testrepo',
    description: 'Test repository',
    language: 'TypeScript',
    defaultBranch: 'main',
    active: true,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Repository;

  const mockCodeStructure: Partial<CodeStructure> = {
    id: 'code-123',
    repositoryId: 'repo-123',
    filePath: 'src/test.ts',
    commitSha: 'commit123',
    functionName: 'testFunction',
    className: 'TestClass',
    signature: 'testFunction(param: string): void',
    fingerprint: 'abcdef123456',
    startLine: 10,
    endLine: 15,
    language: 'typescript',
    active: true,
    metadata: {
      cyclomaticComplexity: 5,
      linesOfCode: 6,
      maintainabilityIndex: 80,
    },
    astData: {
      modifiers: ['public'],
      parameters: [{ name: 'param', type: 'string' }],
      returnType: 'void',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCommits = [
    {
      sha: 'commit123',
      commit: {
        message: 'Add new feature',
        author: { name: 'Test Author', date: '2024-01-01T00:00:00Z' },
      },
    },
  ];

  beforeEach(async () => {
    const mockLLMService = {
      summarizeContent: jest.fn(),
      classifyContent: jest.fn(),
      generateDocument: jest.fn(),
      compareDocumentSimilarity: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          'LLM_MODEL': 'gpt-4',
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisLLMService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CodeAnalysisLLMService>(CodeAnalysisLLMService);
    llmService = module.get(LLMService);
    configService = module.get(ConfigService);
  });

  describe('analyzeCodeChangesForDocumentation', () => {
    it('should analyze code changes and return documentation update response', async () => {
      const mockSummaryResponse = {
        summary: 'Added new public API function',
        keyPoints: ['New function', 'Public API', 'Breaking change'],
        decisions: ['Add to documentation'],
        actionItems: ['Update README'],
        participants: ['developer'],
        tags: ['api', 'feature'],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [mockCodeStructure as CodeStructure],
        modified: [],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result).toBeDefined();
      expect(result.shouldUpdate).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Analysis based on code changes');
      expect(result.suggestedUpdates).toBeDefined();
      expect(result.suggestedUpdates.changelog?.shouldUpdate).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.llmModel).toBe('gpt-4');
      expect(llmService.summarizeContent).toHaveBeenCalledTimes(1);
    });

    it('should handle LLM service errors gracefully', async () => {
      llmService.summarizeContent.mockRejectedValue(new Error('LLM service error'));

      const changes = {
        added: [mockCodeStructure as CodeStructure],
        modified: [],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result).toBeDefined();
      expect(result.shouldUpdate).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('Analysis failed due to system error');
    });

    it('should recommend updates for high-impact public API changes', async () => {
      const highImpactCodeStructure: Partial<CodeStructure> = {
        ...mockCodeStructure,
        metadata: {
          cyclomaticComplexity: 15,
          linesOfCode: 50,
          maintainabilityIndex: 60,
        },
        astData: {
          modifiers: ['public', 'export'],
          parameters: [{ name: 'param', type: 'string' }],
          returnType: 'void',
        },
      };

      const mockSummaryResponse = {
        summary: 'Major API change with high complexity',
        keyPoints: ['API change', 'High complexity', 'Public method'],
        decisions: ['Requires documentation update'],
        actionItems: ['Update API docs', 'Update README'],
        participants: ['developer'],
        tags: ['api', 'breaking-change'],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [],
        modified: [highImpactCodeStructure as CodeStructure],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result.shouldUpdate).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.suggestedUpdates.apiDocs?.shouldUpdate).toBe(true);
      expect(result.suggestedUpdates.readme?.shouldUpdate).toBe(true);
    });

    it('should not recommend updates for minor internal changes', async () => {
      const minorCodeStructure: Partial<CodeStructure> = {
        ...mockCodeStructure,
        metadata: {
          cyclomaticComplexity: 2,
          linesOfCode: 5,
          maintainabilityIndex: 95,
        },
        astData: {
          modifiers: ['private'],
          parameters: [],
          returnType: 'void',
        },
      };

      const mockSummaryResponse = {
        summary: 'Minor internal refactoring',
        keyPoints: ['Internal change'],
        decisions: [],
        actionItems: [],
        participants: ['developer'],
        tags: ['refactor'],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [],
        modified: [minorCodeStructure as CodeStructure],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result.suggestedUpdates.apiDocs?.shouldUpdate).toBe(false);
    });

    it('should handle multiple types of changes', async () => {
      const mockSummaryResponse = {
        summary: 'Multiple changes including API additions and deletions',
        keyPoints: ['New API function', 'Deleted method', 'Modified behavior'],
        decisions: ['Update documentation'],
        actionItems: ['Update API docs', 'Update changelog'],
        participants: ['developer'],
        tags: ['api', 'breaking-change'],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [mockCodeStructure as CodeStructure],
        modified: [mockCodeStructure as CodeStructure],
        deleted: [mockCodeStructure as CodeStructure],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result.shouldUpdate).toBe(true);
      expect(result.suggestedUpdates.changelog?.shouldUpdate).toBe(true);
      expect(result.suggestedUpdates.readme?.shouldUpdate).toBe(true);
    });

    it('should build comprehensive change context', async () => {
      const mockSummaryResponse = {
        summary: 'Test summary',
        keyPoints: ['point1'],
        decisions: [],
        actionItems: [],
        participants: ['developer'],
        tags: ['test'],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [mockCodeStructure as CodeStructure],
        modified: [],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      // Verify that the context was built correctly by checking the response
      expect(result.metadata.analysisDate).toBeDefined();
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      // The reasoning comes from the mock response, so check that it contains our mock data
      expect(result.reasoning).toContain('Analysis based on code changes');
    });
  });

  describe('Configuration', () => {
    it('should initialize with correct configuration', () => {
      expect(configService.get).toHaveBeenCalledWith('LLM_MODEL', 'gpt-4');
      expect(service).toBeDefined();
    });

    it('should use fallback values for missing configuration', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => defaultValue);

      const newService = new CodeAnalysisLLMService(llmService, configService);
      expect(newService).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors in LLM response', async () => {
      llmService.summarizeContent.mockResolvedValue({
        summary: 'Invalid response',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        participants: [],
        tags: [],
      });

      const changes = {
        added: [mockCodeStructure as CodeStructure],
        modified: [],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result).toBeDefined();
      expect(result.shouldUpdate).toBe(true); // Fallback logic
    });

    it('should handle empty changes gracefully', async () => {
      const mockSummaryResponse = {
        summary: 'No significant changes',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        participants: [],
        tags: [],
      };

      llmService.summarizeContent.mockResolvedValue(mockSummaryResponse);

      const changes = {
        added: [],
        modified: [],
        deleted: [],
      };

      const result = await service.analyzeCodeChangesForDocumentation(
        mockRepository,
        changes,
        mockCommits,
      );

      expect(result).toBeDefined();
      expect(result.suggestedUpdates.apiDocs?.shouldUpdate).toBe(false);
    });
  });
}); 
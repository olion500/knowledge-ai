import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LLMService } from './llm.service';
import { LLMProviderFactory } from './providers/llm-provider.factory';
import { LLMProvider } from '../../common/interfaces/llm-provider.interface';
import {
  SummaryRequest,
  ClassificationRequest,
  DocumentGenerationRequest,
} from '../../common/interfaces/llm.interface';

describe('LLMService', () => {
  let service: LLMService;
  let mockProvider: jest.Mocked<LLMProvider>;
  let mockProviderFactory: jest.Mocked<LLMProviderFactory>;

  beforeEach(async () => {
    mockProvider = {
      createCompletion: jest.fn(),
      getModel: jest.fn().mockReturnValue('test-model'),
      isAvailable: jest.fn().mockResolvedValue(true),
    };

    mockProviderFactory = {
      createProvider: jest.fn().mockReturnValue(mockProvider),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: LLMProviderFactory,
          useValue: mockProviderFactory,
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);

    // Mock logger to avoid console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with a provider', () => {
      expect(mockProviderFactory.createProvider).toHaveBeenCalled();
    });
  });

  describe('summarizeContent', () => {
    const mockRequest: SummaryRequest = {
      content: 'Test slack conversation content',
      contentType: 'slack',
      context: {
        channel: 'general',
        participants: ['user1', 'user2'],
      },
    };

    it('should summarize content successfully', async () => {
      const mockResponse = {
        content: JSON.stringify({
          summary: 'Test summary',
          keyPoints: ['Point 1', 'Point 2'],
          decisions: ['Decision 1'],
          actionItems: ['Action 1'],
          participants: ['user1', 'user2'],
          tags: ['tag1', 'tag2'],
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      const result = await service.summarizeContent(mockRequest);

      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('Test slack conversation content') }],
        responseFormat: { type: 'json_object' },
      });

      expect(result).toEqual({
        summary: 'Test summary',
        keyPoints: ['Point 1', 'Point 2'],
        decisions: ['Decision 1'],
        actionItems: ['Action 1'],
        participants: ['user1', 'user2'],
        tags: ['tag1', 'tag2'],
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Summarized slack content successfully using test-model'
      );
    });

    it('should build correct prompt for slack content', async () => {
      const mockResponse = {
        content: JSON.stringify({
          summary: 'Test summary',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          participants: [],
          tags: [],
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      await service.summarizeContent(mockRequest);

      const calledWith = mockProvider.createCompletion.mock.calls[0][0];
      const prompt = calledWith.messages[0].content;

      expect(prompt).toContain('slack conversations');
      expect(prompt).toContain('Channel/Project: general');
      expect(prompt).toContain('Participants: user1, user2');
      expect(prompt).toContain('Test slack conversation content');
      expect(prompt).toContain('JSON response');
    });

    it('should handle content without context', async () => {
      const mockResponse = {
        content: JSON.stringify({
          summary: 'Test summary',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          participants: [],
          tags: [],
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      const requestWithoutContext: SummaryRequest = {
        content: 'Test content',
        contentType: 'jira',
      };

      await service.summarizeContent(requestWithoutContext);

      const calledWith = mockProvider.createCompletion.mock.calls[0][0];
      const prompt = calledWith.messages[0].content;

      expect(prompt).toContain('jira conversations');
      expect(prompt).not.toContain('Context:');
    });

    it('should throw error when no response content', async () => {
      mockProvider.createCompletion.mockResolvedValue({ content: '' });

      await expect(service.summarizeContent(mockRequest)).rejects.toThrow(
        'No response from LLM provider'
      );
    });

    it('should handle provider errors', async () => {
      const error = new Error('Provider error');
      mockProvider.createCompletion.mockRejectedValue(error);

      await expect(service.summarizeContent(mockRequest)).rejects.toThrow('Provider error');
      expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to summarize content', error);
    });

    it('should handle invalid JSON response', async () => {
      mockProvider.createCompletion.mockResolvedValue({ content: 'invalid json' });

      await expect(service.summarizeContent(mockRequest)).rejects.toThrow();
    });
  });

  describe('classifyContent', () => {
    const mockRequest: ClassificationRequest = {
      content: 'Test content to classify',
      availableTopics: ['development', 'support', 'general'],
      context: {
        source: 'slack',
        metadata: { channel: 'dev-team' },
      },
    };

    it('should classify content successfully', async () => {
      const mockResponse = {
        content: JSON.stringify({
          topic: 'development',
          confidence: 0.95,
          reasoning: 'Content discusses code and development',
          suggestedTags: ['coding', 'backend'],
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      const result = await service.classifyContent(mockRequest);

      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('Test content to classify') }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });

      expect(result).toEqual({
        topic: 'development',
        confidence: 0.95,
        reasoning: 'Content discusses code and development',
        suggestedTags: ['coding', 'backend'],
      });

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Classified content as topic: development using test-model'
      );
    });

    it('should build correct classification prompt', async () => {
      const mockResponse = {
        content: JSON.stringify({
          topic: 'development',
          confidence: 0.95,
          reasoning: 'Test reasoning',
          suggestedTags: [],
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      await service.classifyContent(mockRequest);

      const calledWith = mockProvider.createCompletion.mock.calls[0][0];
      const prompt = calledWith.messages[0].content;

      expect(prompt).toContain('Available topics: development, support, general');
      expect(prompt).toContain('Source: slack');
      expect(prompt).toContain('Test content to classify');
      expect(prompt).toContain('JSON response');
    });
  });

  describe('generateDocument', () => {
    const mockRequest: DocumentGenerationRequest = {
      summary: {
        summary: 'Test summary',
        keyPoints: ['Point 1'],
        decisions: ['Decision 1'],
        actionItems: ['Action 1'],
        participants: ['user1'],
        tags: ['tag1'],
      },
      classification: {
        topic: 'development',
        confidence: 0.95,
        reasoning: 'Test reasoning',
        suggestedTags: ['dev', 'code'],
      },
      originalContent: {
        source: 'slack',
        data: { channel: 'dev-team' },
        timestamp: '2024-01-01T00:00:00Z',
      },
    };

    it('should generate document successfully', async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: 'Development Discussion Summary',
          content: '# Development Discussion Summary\n\nTest content',
          metadata: {
            topic: 'development',
            tags: ['dev', 'code'],
            lastUpdated: '2024-01-01T00:00:00Z',
            sources: ['slack'],
            participants: ['user1'],
          },
          isUpdate: false,
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      const result = await service.generateDocument(mockRequest);

      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('Summary data:') }],
        responseFormat: { type: 'json_object' },
      });

      expect(result.title).toBe('Development Discussion Summary');
      expect(result.isUpdate).toBe(false);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Generated document: Development Discussion Summary using test-model'
      );
    });

    it('should handle document update', async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: 'Updated Document',
          content: '# Updated Content',
          metadata: {
            topic: 'development',
            tags: ['dev'],
            lastUpdated: '2024-01-01T00:00:00Z',
            sources: ['slack'],
            participants: ['user1'],
          },
          isUpdate: true,
          changesSummary: 'Added new discussion points',
        }),
      };

      mockProvider.createCompletion.mockResolvedValue(mockResponse);

      const updateRequest: DocumentGenerationRequest = {
        ...mockRequest,
        existingDocument: '# Existing Document\n\nOld content',
      };

      const result = await service.generateDocument(updateRequest);

      expect(result.isUpdate).toBe(true);
      expect(result.changesSummary).toBe('Added new discussion points');

      const calledWith = mockProvider.createCompletion.mock.calls[0][0];
      const prompt = calledWith.messages[0].content;

      expect(prompt).toContain('Existing document to update:');
      expect(prompt).toContain('# Existing Document');
    });
  });

  describe('checkProviderAvailability', () => {
    it('should return provider availability status', async () => {
      mockProvider.isAvailable.mockResolvedValue(true);
      mockProvider.getModel.mockReturnValue('gpt-4');

      const result = await service.checkProviderAvailability();

      expect(result).toEqual({
        available: true,
        provider: expect.any(String),
        model: 'gpt-4',
      });
    });

    it('should return false when provider is unavailable', async () => {
      mockProvider.isAvailable.mockResolvedValue(false);

      const result = await service.checkProviderAvailability();

      expect(result.available).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle JSON parsing errors in all methods', async () => {
      mockProvider.createCompletion.mockResolvedValue({ content: 'invalid json' });

      const summaryRequest: SummaryRequest = {
        content: 'Test',
        contentType: 'slack',
      };

      await expect(service.summarizeContent(summaryRequest)).rejects.toThrow();
    });

    it('should log errors with proper context', async () => {
      const error = new Error('Test error');
      mockProvider.createCompletion.mockRejectedValue(error);

      const summaryRequest: SummaryRequest = {
        content: 'Test',
        contentType: 'slack',
      };

      await expect(service.summarizeContent(summaryRequest)).rejects.toThrow('Test error');
      expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to summarize content', error);
    });
  });

  describe('compareDocumentSimilarity', () => {
    it('should identify similar documents', async () => {
      const mockSimilarity = {
        similarityScore: 0.85,
        reasoning: 'Both documents discuss the same product feature with minor differences',
        keyDifferences: ['Slight wording changes', 'Updated participant list'],
      };

      mockProvider.createCompletion.mockResolvedValue({
        content: JSON.stringify(mockSimilarity),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      });

      const request = {
        existingContent: '# Product Feature\n\nThis document discusses the new login feature implementation...',
        newSummary: {
          summary: 'Discussion about login feature implementation',
          keyPoints: ['Feature requirements', 'Implementation approach'],
          decisions: ['Use OAuth2'],
          actionItems: ['Create wireframes'],
          participants: ['john', 'jane'],
          tags: ['feature', 'login'],
        },
        classification: {
          topic: 'product-planning',
          confidence: 0.95,
          reasoning: 'Discussion about product features',
          suggestedTags: ['product', 'feature'],
        },
        similarityThreshold: 0.8,
        context: {
          source: 'slack' as const,
          participants: ['john', 'jane'],
        },
      };

      const result = await service.compareDocumentSimilarity(request);

      expect(result).toEqual(mockSimilarity);
      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('semantic similarity') }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });
    });

    it('should identify different documents', async () => {
      const mockSimilarity = {
        similarityScore: 0.3,
        reasoning: 'Documents discuss different aspects of the system',
        keyDifferences: ['Different decisions made', 'New action items', 'Different participants'],
      };

      mockProvider.createCompletion.mockResolvedValue({
        content: JSON.stringify(mockSimilarity),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      });

      const request = {
        existingContent: '# Security Policy\n\nThis document outlines security requirements...',
        newSummary: {
          summary: 'Discussion about new payment integration',
          keyPoints: ['Payment gateway selection', 'Security considerations'],
          decisions: ['Use Stripe API'],
          actionItems: ['Setup payment processing'],
          participants: ['alice', 'bob'],
          tags: ['payment', 'integration'],
        },
        classification: {
          topic: 'technical-architecture',
          confidence: 0.9,
          reasoning: 'Discussion about technical implementation',
          suggestedTags: ['architecture', 'payment'],
        },
      };

      const result = await service.compareDocumentSimilarity(request);

      expect(result).toEqual(mockSimilarity);
      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('semantic similarity') }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });
    });

    it('should handle similarity comparison errors', async () => {
      mockProvider.createCompletion.mockRejectedValue(new Error('API Error'));

      const request = {
        existingContent: 'Some content',
        newSummary: {} as any,
        classification: {} as any,
      };

      await expect(service.compareDocumentSimilarity(request)).rejects.toThrow('API Error');
    });

    it('should use default threshold when not specified', async () => {
      const mockSimilarity = {
        similarityScore: 0.5,
        reasoning: 'Using default threshold of 0.7',
        keyDifferences: ['Default threshold test'],
      };

      mockProvider.createCompletion.mockResolvedValue({
        content: JSON.stringify(mockSimilarity),
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      });

      const request = {
        existingContent: '# Test Document',
        newSummary: {
          summary: 'Test summary',
          keyPoints: [],
          decisions: [],
          actionItems: [],
          participants: [],
          tags: [],
        },
        classification: {
          topic: 'general-discussion',
          confidence: 0.8,
          reasoning: 'Test classification',
          suggestedTags: [],
        },
        // No similarityThreshold specified
      };

      const result = await service.compareDocumentSimilarity(request);

      expect(result).toEqual(mockSimilarity);
      expect(mockProvider.createCompletion).toHaveBeenCalledWith({
        messages: [{ role: 'user', content: expect.stringContaining('semantic similarity') }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });
    });
  });
}); 
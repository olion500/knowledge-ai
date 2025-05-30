import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLMService } from './llm.service';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('LLMService', () => {
  let service: LLMService;
  let configService: ConfigService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                OPENAI_API_KEY: 'mock-api-key',
                OPENAI_MODEL: 'gpt-4-turbo-preview',
                MAX_TOKENS: 4000,
                TEMPERATURE: 0.3,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LLMService>(LLMService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Get the mocked OpenAI instance
    mockOpenAI = (OpenAI as jest.MockedClass<typeof OpenAI>).mock.instances[0] as jest.Mocked<OpenAI>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('summarizeContent', () => {
    it('should return parsed summary response', async () => {
      const mockResponse = {
        summary: 'Test summary',
        keyPoints: ['Point 1', 'Point 2'],
        decisions: ['Decision 1'],
        actionItems: ['Action 1'],
        participants: ['user1', 'user2'],
        tags: ['tag1', 'tag2'],
      };

      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        content: 'Test content',
        contentType: 'slack' as const,
        context: {
          channel: 'general',
          participants: ['user1', 'user2'],
        },
      };

      const result = await service.summarizeContent(request);

      expect(result).toEqual(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: expect.stringContaining('Test content') }],
        max_tokens: 4000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
    });

    it('should handle context-less requests', async () => {
      const mockResponse = {
        summary: 'Test summary',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        participants: [],
        tags: [],
      };

      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        content: 'Test content',
        contentType: 'jira' as const,
      };

      const result = await service.summarizeContent(request);

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when no response from OpenAI', async () => {
      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: null,
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        content: 'Test content',
        contentType: 'slack' as const,
      };

      await expect(service.summarizeContent(request)).rejects.toThrow('No response from OpenAI');
    });

    it('should throw error when OpenAI API fails', async () => {
      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      } as any;

      const request = {
        content: 'Test content',
        contentType: 'slack' as const,
      };

      await expect(service.summarizeContent(request)).rejects.toThrow('API Error');
    });
  });

  describe('classifyContent', () => {
    it('should return classification response', async () => {
      const mockResponse = {
        topic: 'product-planning',
        confidence: 0.95,
        reasoning: 'Content discusses product features',
        suggestedTags: ['product', 'planning'],
      };

      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        content: 'We need to plan the next product release',
        availableTopics: ['product-planning', 'technical-architecture'],
        context: {
          source: 'slack' as const,
          metadata: { channel: 'product' },
        },
      };

      const result = await service.classifyContent(request);

      expect(result).toEqual(mockResponse);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: expect.stringContaining('product-planning, technical-architecture') }],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
    });
  });

  describe('generateDocument', () => {
    it('should generate new document', async () => {
      const mockResponse = {
        title: 'Product Planning Discussion',
        content: '# Product Planning Discussion\n\nContent here...',
        metadata: {
          topic: 'product-planning',
          tags: ['product', 'planning'],
          lastUpdated: '2024-01-01T00:00:00.000Z',
          sources: ['slack'],
          participants: ['user1', 'user2'],
        },
        isUpdate: false,
      };

      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        summary: {
          summary: 'Test summary',
          keyPoints: ['Point 1'],
          decisions: ['Decision 1'],
          actionItems: ['Action 1'],
          participants: ['user1', 'user2'],
          tags: ['product'],
        },
        classification: {
          topic: 'product-planning',
          confidence: 0.95,
          reasoning: 'Product discussion',
          suggestedTags: ['product'],
        },
        originalContent: {
          source: 'slack' as const,
          data: {},
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      };

      const result = await service.generateDocument(request);

      expect(result).toEqual(mockResponse);
      expect(result.isUpdate).toBe(false);
    });

    it('should generate document update', async () => {
      const mockResponse = {
        title: 'Product Planning Discussion',
        content: '# Product Planning Discussion\n\nUpdated content...',
        metadata: {
          topic: 'product-planning',
          tags: ['product', 'planning'],
          lastUpdated: '2024-01-01T00:00:00.000Z',
          sources: ['slack'],
          participants: ['user1', 'user2'],
        },
        isUpdate: true,
        changesSummary: 'Added new discussion points',
      };

      mockOpenAI.chat = {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify(mockResponse),
                },
              },
            ],
          }),
        },
      } as any;

      const request = {
        summary: {
          summary: 'Test summary',
          keyPoints: ['Point 1'],
          decisions: ['Decision 1'],
          actionItems: ['Action 1'],
          participants: ['user1', 'user2'],
          tags: ['product'],
        },
        classification: {
          topic: 'product-planning',
          confidence: 0.95,
          reasoning: 'Product discussion',
          suggestedTags: ['product'],
        },
        originalContent: {
          source: 'slack' as const,
          data: {},
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        existingDocument: '# Existing Document\n\nExisting content...',
      };

      const result = await service.generateDocument(request);

      expect(result).toEqual(mockResponse);
      expect(result.isUpdate).toBe(true);
      expect(result.changesSummary).toBeDefined();
    });
  });

  describe('buildSummaryPrompt', () => {
    it('should build prompt with context', () => {
      const request = {
        content: 'Test content',
        contentType: 'slack' as const,
        context: {
          channel: 'general',
          participants: ['user1', 'user2'],
        },
      };

      // Access private method for testing
      const prompt = (service as any).buildSummaryPrompt(request);

      expect(prompt).toContain('slack');
      expect(prompt).toContain('general');
      expect(prompt).toContain('user1, user2');
      expect(prompt).toContain('Test content');
    });

    it('should build prompt without context', () => {
      const request = {
        content: 'Test content',
        contentType: 'jira' as const,
      };

      const prompt = (service as any).buildSummaryPrompt(request);

      expect(prompt).toContain('jira');
      expect(prompt).toContain('Test content');
      expect(prompt).not.toContain('Context:');
    });
  });
}); 
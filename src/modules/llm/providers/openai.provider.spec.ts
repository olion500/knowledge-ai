import { Logger } from '@nestjs/common';
import { OpenAIProvider } from './openai.provider';
import { LLMProviderConfig } from '../../../common/interfaces/llm-provider.interface';

// Mock OpenAI
jest.mock('openai');
import OpenAI from 'openai';

const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockCreateCompletion: jest.Mock;
  let mockListModels: jest.Mock;
  let config: LLMProviderConfig;

  beforeEach(() => {
    config = {
      type: 'openai',
      apiKey: 'test-api-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4-turbo-preview',
      maxTokens: 4000,
      temperature: 0.3,
    };

    mockCreateCompletion = jest.fn();
    mockListModels = jest.fn();

    MockedOpenAI.mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreateCompletion,
            },
          },
          models: {
            list: mockListModels,
          },
        }) as any,
    );

    provider = new OpenAIProvider(config);

    // Mock logger to avoid console output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct config', () => {
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: 'https://api.openai.com/v1',
      });
    });

    it('should handle missing baseUrl', () => {
      const configWithoutBaseUrl = { ...config };
      delete configWithoutBaseUrl.baseUrl;

      new OpenAIProvider(configWithoutBaseUrl);

      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: undefined,
      });
    });
  });

  describe('createCompletion', () => {
    const mockRequest = {
      messages: [{ role: 'user' as const, content: 'Test message' }],
      maxTokens: 1000,
      temperature: 0.5,
      responseFormat: { type: 'json_object' as const },
    };

    it('should create completion successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: '{"result": "success"}' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      mockCreateCompletion.mockResolvedValue(mockResponse);

      const result = await provider.createCompletion(mockRequest);

      expect(mockCreateCompletion).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: mockRequest.messages,
        max_tokens: 1000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      expect(result).toEqual({
        content: '{"result": "success"}',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
        finishReason: 'stop',
      });
    });

    it('should use config defaults when request values not provided', async () => {
      const mockResponse = {
        choices: [
          { message: { content: 'Test response' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };

      mockCreateCompletion.mockResolvedValue(mockResponse);

      const minimalRequest = {
        messages: [{ role: 'user' as const, content: 'Test' }],
      };

      await provider.createCompletion(minimalRequest);

      expect(mockCreateCompletion).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: minimalRequest.messages,
        max_tokens: 4000, // from config
        temperature: 0.3, // from config
        response_format: undefined,
      });
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        choices: [
          { message: { content: 'Test response' }, finish_reason: 'stop' },
        ],
        usage: null,
      };

      mockCreateCompletion.mockResolvedValue(mockResponse);

      const result = await provider.createCompletion(mockRequest);

      expect(result.usage).toBeUndefined();
    });

    it('should throw error when no response content', async () => {
      const mockResponse = {
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
      };

      mockCreateCompletion.mockResolvedValue(mockResponse);

      await expect(provider.createCompletion(mockRequest)).rejects.toThrow(
        'No response content from OpenAI',
      );
    });

    it('should handle OpenAI errors', async () => {
      const error = new Error('OpenAI API Error');
      mockCreateCompletion.mockRejectedValue(error);

      await expect(provider.createCompletion(mockRequest)).rejects.toThrow(
        'OpenAI API Error',
      );
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'OpenAI completion failed',
        error,
      );
    });

    it('should handle temperature 0 correctly', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };

      mockCreateCompletion.mockResolvedValue(mockResponse);

      const requestWithZeroTemp = {
        ...mockRequest,
        temperature: 0,
      };

      await provider.createCompletion(requestWithZeroTemp);

      expect(mockCreateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        }),
      );
    });
  });

  describe('getModel', () => {
    it('should return the configured model', () => {
      expect(provider.getModel()).toBe('gpt-4-turbo-preview');
    });
  });

  describe('isAvailable', () => {
    it('should return true when model is available', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'gpt-4-turbo-preview' },
          { id: 'gpt-4' },
        ],
      };

      mockListModels.mockResolvedValue(mockModels);

      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(mockListModels).toHaveBeenCalled();
    });

    it('should return false when model is not available', async () => {
      const mockModels = {
        data: [{ id: 'gpt-3.5-turbo' }, { id: 'gpt-4' }],
      };

      mockListModels.mockResolvedValue(mockModels);

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const error = new Error('API Error');
      mockListModels.mockRejectedValue(error);

      const result = await provider.isAvailable();

      expect(result).toBe(false);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'OpenAI availability check failed',
        error,
      );
    });
  });
});

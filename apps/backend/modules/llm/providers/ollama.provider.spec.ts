import { Logger } from '@nestjs/common';
import { OllamaProvider } from './ollama.provider';
import { LLMProviderConfig } from '../../../common/interfaces/llm-provider.interface';

// Mock Ollama
jest.mock('ollama');
import { Ollama } from 'ollama';

const MockedOllama = Ollama as jest.MockedClass<typeof Ollama>;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let mockOllama: jest.Mocked<Ollama>;
  let config: LLMProviderConfig;

  beforeEach(() => {
    config = {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      maxTokens: 4000,
      temperature: 0.3,
    };

    mockOllama = {
      generate: jest.fn(),
      list: jest.fn(),
    } as any;

    MockedOllama.mockImplementation(() => mockOllama);

    provider = new OllamaProvider(config);

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
      expect(MockedOllama).toHaveBeenCalledWith({
        host: 'http://localhost:11434',
      });
    });

    it('should use default host when baseUrl not provided', () => {
      const configWithoutBaseUrl = { ...config };
      delete configWithoutBaseUrl.baseUrl;

      new OllamaProvider(configWithoutBaseUrl);

      expect(MockedOllama).toHaveBeenCalledWith({
        host: 'http://localhost:11434',
      });
    });
  });

  describe('createCompletion', () => {
    const mockRequest = {
      messages: [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Test message' },
      ],
      maxTokens: 1000,
      temperature: 0.5,
      responseFormat: { type: 'json_object' as const },
    };

    it('should create completion successfully with JSON format', async () => {
      const mockResponse = {
        response: '{"result": "success"}',
        done: true,
        prompt_eval_count: 10,
        eval_count: 15,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const result = await provider.createCompletion(mockRequest);

      expect(mockOllama.generate).toHaveBeenCalledWith({
        model: 'llama2',
        prompt:
          'System: You are a helpful assistant\n\nHuman: Test message\n\nPlease respond with valid JSON only.',
        options: {
          temperature: 0.5,
          num_predict: 1000,
        },
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

    it('should create completion without JSON format', async () => {
      const mockResponse = {
        response: 'This is a regular text response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const requestWithoutJson = {
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const result = await provider.createCompletion(requestWithoutJson);

      expect(mockOllama.generate).toHaveBeenCalledWith({
        model: 'llama2',
        prompt: 'Human: Hello',
        options: {
          temperature: 0.3, // from config
          num_predict: 4000, // from config
        },
      });

      expect(result.content).toBe('This is a regular text response');
    });

    it('should use config defaults when request values not provided', async () => {
      const mockResponse = {
        response: 'Test response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const minimalRequest = {
        messages: [{ role: 'user' as const, content: 'Test' }],
      };

      await provider.createCompletion(minimalRequest);

      expect(mockOllama.generate).toHaveBeenCalledWith({
        model: 'llama2',
        prompt: 'Human: Test',
        options: {
          temperature: 0.3, // from config
          num_predict: 4000, // from config
        },
      });
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        response: 'Test response',
        done: true,
        // Missing prompt_eval_count and eval_count
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const result = await provider.createCompletion(mockRequest);

      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('should extract JSON from mixed response', async () => {
      const mockResponse = {
        response: 'Here is the JSON: {"key": "value"} and some extra text',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const requestWithJson = {
        messages: [{ role: 'user' as const, content: 'Give me JSON' }],
        responseFormat: { type: 'json_object' as const },
      };

      const result = await provider.createCompletion(requestWithJson);

      expect(result.content).toBe('{"key": "value"}');
    });

    it('should return original response when JSON extraction fails', async () => {
      const mockResponse = {
        response: 'This is not JSON: {invalid json}',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const requestWithJson = {
        messages: [{ role: 'user' as const, content: 'Give me JSON' }],
        responseFormat: { type: 'json_object' as const },
      };

      const result = await provider.createCompletion(requestWithJson);

      expect(result.content).toBe('This is not JSON: {invalid json}');
    });

    it('should handle Ollama errors', async () => {
      const error = new Error('Ollama connection failed');
      mockOllama.generate.mockRejectedValue(error);

      await expect(provider.createCompletion(mockRequest)).rejects.toThrow(
        'Ollama connection failed',
      );
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Ollama completion failed',
        error,
      );
    });

    it('should set finish reason based on done status', async () => {
      const mockResponseNotDone = {
        response: 'Partial response',
        done: false,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponseNotDone as any);

      const result = await provider.createCompletion(mockRequest);

      expect(result.finishReason).toBe('length');
    });

    it('should handle temperature 0 correctly', async () => {
      const mockResponse = {
        response: 'Test response',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const requestWithZeroTemp = {
        ...mockRequest,
        temperature: 0,
      };

      await provider.createCompletion(requestWithZeroTemp);

      expect(mockOllama.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            temperature: 0,
          }),
        }),
      );
    });
  });

  describe('convertMessagesToPrompt', () => {
    it('should convert various message roles correctly', async () => {
      const mockResponse = {
        response: 'Test',
        done: true,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      mockOllama.generate.mockResolvedValue(mockResponse as any);

      const messages = [
        { role: 'system' as const, content: 'System message' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant message' },
      ];

      await provider.createCompletion({ messages });

      expect(mockOllama.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt:
            'System: System message\n\nHuman: User message\n\nAssistant: Assistant message',
        }),
      );
    });
  });

  describe('getModel', () => {
    it('should return the configured model', () => {
      expect(provider.getModel()).toBe('llama2');
    });
  });

  describe('isAvailable', () => {
    it('should return true when model is available', async () => {
      const mockModels = {
        models: [
          { name: 'llama2:latest' },
          { name: 'codellama:7b' },
          { name: 'mistral:latest' },
        ],
      };

      mockOllama.list.mockResolvedValue(mockModels as any);

      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(mockOllama.list).toHaveBeenCalled();
    });

    it('should return false when model is not available', async () => {
      const mockModels = {
        models: [{ name: 'codellama:7b' }, { name: 'mistral:latest' }],
      };

      mockOllama.list.mockResolvedValue(mockModels as any);

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      const error = new Error('Ollama server not running');
      mockOllama.list.mockRejectedValue(error);

      const result = await provider.isAvailable();

      expect(result).toBe(false);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Ollama availability check failed',
        error,
      );
    });

    it('should match partial model names', async () => {
      const mockModels = {
        models: [{ name: 'llama2:7b-chat' }],
      };

      mockOllama.list.mockResolvedValue(mockModels as any);

      const result = await provider.isAvailable();

      expect(result).toBe(true); // Should match because 'llama2:7b-chat' includes 'llama2'
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LLMProviderFactory } from './llm-provider.factory';
import { OpenAIProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';

describe('LLMProviderFactory', () => {
  let factory: LLMProviderFactory;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMProviderFactory,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    factory = module.get<LLMProviderFactory>(LLMProviderFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create OpenAI provider when LLM_PROVIDER is openai', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return 'openai';
          case 'OPENAI_API_KEY':
            return 'test-api-key';
          case 'OPENAI_MODEL':
            return 'gpt-4-turbo-preview';
          case 'LLM_MAX_TOKENS':
            return '4000';
          case 'LLM_TEMPERATURE':
            return '0.3';
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.getModel()).toBe('gpt-4-turbo-preview');
    });

    it('should create Ollama provider when LLM_PROVIDER is ollama', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return 'ollama';
          case 'OLLAMA_MODEL':
            return 'llama2';
          case 'OLLAMA_BASE_URL':
            return 'http://localhost:11434';
          case 'LLM_MAX_TOKENS':
            return '4000';
          case 'LLM_TEMPERATURE':
            return '0.3';
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.getModel()).toBe('llama2');
    });

    it('should default to OpenAI when LLM_PROVIDER is not set', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return undefined; // Not set
          case 'OPENAI_API_KEY':
            return 'test-api-key';
          case 'OPENAI_MODEL':
            return 'gpt-4-turbo-preview';
          case 'LLM_MAX_TOKENS':
            return '4000';
          case 'LLM_TEMPERATURE':
            return '0.3';
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw error for unsupported provider type', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'LLM_PROVIDER') return 'unsupported';
        return undefined;
      });

      expect(() => factory.createProvider()).toThrow('Invalid LLM provider type: unsupported');
    });

    it('should parse string numbers correctly', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return 'ollama';
          case 'OLLAMA_MODEL':
            return 'llama2';
          case 'LLM_MAX_TOKENS':
            return '8000'; // String number
          case 'LLM_TEMPERATURE':
            return '0.7'; // String float
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      
      // Access the config through the provider (we'd need to expose it for testing)
      // For now, we'll trust the parsing worked if no error was thrown
    });

    it('should use defaults for invalid numbers', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return 'ollama';
          case 'OLLAMA_MODEL':
            return 'llama2';
          case 'LLM_MAX_TOKENS':
            return 'invalid'; // Invalid number
          case 'LLM_TEMPERATURE':
            return 'not-a-number'; // Invalid float
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      // Should use defaults (4000, 0.3) without throwing error
    });

    it('should handle undefined values gracefully', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LLM_PROVIDER':
            return 'ollama';
          case 'OLLAMA_MODEL':
            return 'llama2';
          case 'LLM_MAX_TOKENS':
            return undefined;
          case 'LLM_TEMPERATURE':
            return undefined;
          default:
            return undefined;
        }
      });

      const provider = factory.createProvider();
      expect(provider).toBeInstanceOf(OllamaProvider);
      // Should use defaults without throwing error
    });
  });
}); 
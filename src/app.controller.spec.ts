import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LLMService } from './modules/llm/llm.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: jest.Mocked<AppService>;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(async () => {
    mockLLMService = {
      checkProviderAvailability: jest.fn(),
    } as any;

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get(AppService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      
      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('LLM health', () => {
    it('should return LLM provider health when available', async () => {
      const mockProviderStatus = {
        available: true,
        provider: 'OpenAIProvider',
        model: 'gpt-4-turbo-preview',
      };

      mockLLMService.checkProviderAvailability.mockResolvedValue(mockProviderStatus);

      const result = await appController.getLLMHealth();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        available: true,
        provider: 'OpenAIProvider',
        model: 'gpt-4-turbo-preview',
      });

      expect(mockLLMService.checkProviderAvailability).toHaveBeenCalled();
    });

    it('should return LLM provider health when unavailable', async () => {
      const mockProviderStatus = {
        available: false,
        provider: 'OllamaProvider',
        model: 'llama2',
      };

      mockLLMService.checkProviderAvailability.mockResolvedValue(mockProviderStatus);

      const result = await appController.getLLMHealth();

      expect(result).toEqual({
        status: 'unavailable',
        timestamp: expect.any(String),
        available: false,
        provider: 'OllamaProvider',
        model: 'llama2',
      });
    });

    it('should handle LLM service errors', async () => {
      const error = new Error('LLM service error');
      mockLLMService.checkProviderAvailability.mockRejectedValue(error);

      const result = await appController.getLLMHealth();

      expect(result).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        error: 'LLM service error',
      });
    });
  });
});

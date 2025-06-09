import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  LLMProviderConfig,
} from '../../../common/interfaces/llm-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';

@Injectable()
export class LLMProviderFactory {
  private readonly logger = new Logger(LLMProviderFactory.name);

  constructor(private readonly configService: ConfigService) {}

  createProvider(): LLMProvider {
    const config = this.getProviderConfig();

    switch (config.type) {
      case 'openai':
        this.logger.log(`Creating OpenAI provider with model: ${config.model}`);
        return new OpenAIProvider(config);

      case 'ollama':
        this.logger.log(`Creating Ollama provider with model: ${config.model}`);
        return new OllamaProvider(config);

      default:
        throw new Error(`Unsupported LLM provider type: ${config.type}`);
    }
  }

  private getProviderConfig(): LLMProviderConfig {
    const type = this.configService.get<string>('LLM_PROVIDER') || 'openai';

    if (type !== 'openai' && type !== 'ollama') {
      throw new Error(
        `Invalid LLM provider type: ${type}. Must be 'openai' or 'ollama'`,
      );
    }

    // Properly parse numeric values from environment variables
    const maxTokens = this.parseNumber(
      this.configService.get<string>('LLM_MAX_TOKENS'),
      4000,
    );
    const temperature = this.parseFloat(
      this.configService.get<string>('LLM_TEMPERATURE'),
      0.3,
    );

    const baseConfig = {
      type: type,
      maxTokens,
      temperature,
    };

    if (type === 'openai') {
      return {
        ...baseConfig,
        apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        baseUrl: this.configService.get<string>('OPENAI_BASE_URL'),
        model:
          this.configService.get<string>('OPENAI_MODEL') ||
          'gpt-4-turbo-preview',
      };
    }

    if (type === 'ollama') {
      return {
        ...baseConfig,
        baseUrl:
          this.configService.get<string>('OLLAMA_BASE_URL') ||
          'http://localhost:11434',
        model: this.configService.get<string>('OLLAMA_MODEL') || 'llama2',
      };
    }

    throw new Error(`Failed to create config for provider type: ${type}`);
  }

  private parseNumber(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseFloat(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
}

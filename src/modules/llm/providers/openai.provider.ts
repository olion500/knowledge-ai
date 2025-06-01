import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '../../../common/interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements LLMProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly openai: OpenAI;
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async createCompletion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: request.messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
        response_format: request.responseFormat,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        content: choice.message.content,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason || undefined,
      };
    } catch (error) {
      this.logger.error('OpenAI completion failed', error);
      throw error;
    }
  }

  getModel(): string {
    return this.config.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const models = await this.openai.models.list();
      return models.data.some(model => model.id === this.config.model);
    } catch (error) {
      this.logger.warn('OpenAI availability check failed', error);
      return false;
    }
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { Ollama } from 'ollama';
import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '../../../common/interfaces/llm-provider.interface';

@Injectable()
export class OllamaProvider implements LLMProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly ollama: Ollama;
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.ollama = new Ollama({
      host: config.baseUrl || 'http://localhost:11434',
    });
  }

  async createCompletion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    try {
      // Convert messages to a single prompt for Ollama
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      // For JSON responses, we need to instruct the model explicitly
      const finalPrompt = request.responseFormat?.type === 'json_object' 
        ? `${prompt}\n\nPlease respond with valid JSON only.`
        : prompt;

      // Ensure temperature is a proper number (float32)
      const temperature = Number(request.temperature ?? this.config.temperature ?? 0.3);
      const maxTokens = Number(request.maxTokens || this.config.maxTokens || 4000);

      const response = await this.ollama.generate({
        model: this.config.model,
        prompt: finalPrompt,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      });

      let content = response.response;

      // If JSON was requested, try to clean up the response
      if (request.responseFormat?.type === 'json_object') {
        content = this.extractJsonFromResponse(content);
      }

      return {
        content,
        usage: {
          promptTokens: response.prompt_eval_count || 0,
          completionTokens: response.eval_count || 0,
          totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
        },
        finishReason: response.done ? 'stop' : 'length',
      };
    } catch (error) {
      this.logger.error('Ollama completion failed', error);
      throw error;
    }
  }

  getModel(): string {
    return this.config.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const models = await this.ollama.list();
      return models.models.some(model => model.name.includes(this.config.model));
    } catch (error) {
      this.logger.warn('Ollama availability check failed', error);
      return false;
    }
  }

  private convertMessagesToPrompt(messages: Array<{ role: string; content: string }>): string {
    return messages
      .map(message => {
        switch (message.role) {
          case 'system':
            return `System: ${message.content}`;
          case 'user':
            return `Human: ${message.content}`;
          case 'assistant':
            return `Assistant: ${message.content}`;
          default:
            return message.content;
        }
      })
      .join('\n\n');
  }

  private extractJsonFromResponse(response: string): string {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Validate it's valid JSON
        JSON.parse(jsonMatch[0]);
        return jsonMatch[0];
      } catch {
        // If not valid JSON, return original
        return response;
      }
    }
    return response;
  }
} 
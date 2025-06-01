import { Module } from '@nestjs/common';
import { LLMService } from './llm.service';
import { LLMProviderFactory } from './providers/llm-provider.factory';

@Module({
  providers: [LLMService, LLMProviderFactory],
  exports: [LLMService],
})
export class LLMModule {} 
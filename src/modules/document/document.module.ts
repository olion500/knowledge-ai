import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { SlackModule } from '../slack/slack.module';
import { LLMModule } from '../llm/llm.module';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [SlackModule, LLMModule, GitHubModule],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {} 
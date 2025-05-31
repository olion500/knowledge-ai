import { Module } from '@nestjs/common';
import { GitHubService } from './github.service';
import { GitHubController } from './github.controller';

@Module({
  providers: [GitHubService],
  controllers: [GitHubController],
  exports: [GitHubService],
})
export class GitHubModule {} 
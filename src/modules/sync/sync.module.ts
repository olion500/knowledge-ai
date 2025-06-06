import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncJob } from '../../common/entities/sync-job.entity';
import { Repository } from '../../common/entities/repository.entity';
import { DocumentationUpdate } from '../../common/entities/documentation-update.entity';
import { RepositoryModule } from '../repository/repository.module';
import { CodeAnalysisModule } from '../code-analysis/code-analysis.module';
import { GitHubModule } from '../github/github.module';
import { LLMModule } from '../llm/llm.module';
import { CodeAnalysisLLMService } from '../code-analysis/services/code-analysis-llm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncJob, Repository, DocumentationUpdate]),
    ScheduleModule.forRoot(),
    RepositoryModule,
    CodeAnalysisModule,
    GitHubModule,
    LLMModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, CodeAnalysisLLMService],
  exports: [SyncService, CodeAnalysisLLMService],
})
export class SyncModule {} 
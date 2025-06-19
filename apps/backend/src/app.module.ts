import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from './config/database.config';

import { SlackModule } from './modules/slack/slack.module';
import { JiraModule } from './modules/jira/jira.module';
import { GithubModule } from './modules/github/github.module';
import { LLMModule } from './modules/llm/llm.module';
import { DocumentModule } from './modules/document/document.module';
import { CodeTrackingModule } from './modules/code-tracking/code-tracking.module';
import { CodeAnalysisModule } from './modules/code-analysis/code-analysis.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    ScheduleModule.forRoot(),
    SlackModule,
    JiraModule,
    GithubModule,
    LLMModule,
    DocumentModule,
    CodeTrackingModule,
    CodeAnalysisModule,
    RepositoryModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {} 
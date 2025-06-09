import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeStructure } from '../../common/entities/code-structure.entity';
import { CodeChangeLog } from '../../common/entities/code-change-log.entity';
import { CodeAnalysisService } from './code-analysis.service';
import { TypeScriptParser } from './parsers/typescript-parser';
import { RepositoryModule } from '../repository/repository.module';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CodeStructure, CodeChangeLog]),
    RepositoryModule,
    GitHubModule,
  ],
  providers: [CodeAnalysisService, TypeScriptParser],
  exports: [CodeAnalysisService],
})
export class CodeAnalysisModule {}

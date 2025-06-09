import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeTrackingService } from './code-tracking.service';
import { CodeTrackingController } from './code-tracking.controller';
import { CodeParserService } from './services/code-parser.service';
import { CodeExtractorService } from './services/code-extractor.service';
import { CodeReference } from '../../common/entities/code-reference.entity';
import { DocumentCodeLink } from '../../common/entities/document-code-link.entity';
import { GitHubModule } from '../github/github.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CodeReference, DocumentCodeLink]),
    GitHubModule,
  ],
  controllers: [CodeTrackingController],
  providers: [CodeTrackingService, CodeParserService, CodeExtractorService],
  exports: [CodeTrackingService],
})
export class CodeTrackingModule {}

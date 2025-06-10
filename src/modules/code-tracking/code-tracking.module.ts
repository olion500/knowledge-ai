import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CodeTrackingService } from './code-tracking.service';
import { CodeTrackingController } from './code-tracking.controller';
import { WebhookController } from './controllers/webhook.controller';
import { CodeParserService } from './services/code-parser.service';
import { CodeExtractorService } from './services/code-extractor.service';
import { GitHubWebhookService } from './services/github-webhook.service';
import { SmartCodeTrackingService } from './services/smart-code-tracking.service';
import { NotificationService } from './services/notification.service';
import { CodeReference } from '../../common/entities/code-reference.entity';
import { DocumentCodeLink } from '../../common/entities/document-code-link.entity';
import { CodeChangeEvent } from '../../common/entities/code-change-event.entity';
import { GitHubModule } from '../github/github.module';
// import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CodeReference, DocumentCodeLink, CodeChangeEvent]),
    GitHubModule,
    // SlackModule,
    ConfigModule,
  ],
  controllers: [CodeTrackingController, WebhookController],
  providers: [
    CodeTrackingService,
    CodeParserService,
    CodeExtractorService,
    GitHubWebhookService,
    SmartCodeTrackingService,
    NotificationService,
    {
      provide: 'SlackService',
      useValue: {
        sendMessage: () => Promise.resolve({ ok: true }),
        sendCodeChangeNotification: () => Promise.resolve({ ok: true }),
      },
    },
  ],
  exports: [
    CodeTrackingService,
    CodeParserService,
    CodeExtractorService,
    GitHubWebhookService,
    SmartCodeTrackingService,
    NotificationService,
  ],
})
export class CodeTrackingModule {}

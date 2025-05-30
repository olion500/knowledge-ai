import { Module, forwardRef } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { SlackEventHandler } from './slack-event.handler';
import { DocumentModule } from '../document/document.module';

@Module({
  imports: [forwardRef(() => DocumentModule)],
  controllers: [SlackController],
  providers: [SlackService, SlackEventHandler],
  exports: [SlackService],
})
export class SlackModule {} 
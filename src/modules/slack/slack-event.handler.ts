import { Injectable } from '@nestjs/common';
import { SlackEventPayload } from '../../common/interfaces/slack.interface';

@Injectable()
export class SlackEventHandler {
  async handleEvent(payload: SlackEventPayload): Promise<any> {
    // Basic event handler - can be expanded later
    return {};
  }
} 
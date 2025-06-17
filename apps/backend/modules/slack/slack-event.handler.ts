import { Injectable } from '@nestjs/common';
import { SlackEventPayload } from '../../common/interfaces/slack.interface';

@Injectable()
export class SlackEventHandler {
  handleEvent(payload: SlackEventPayload): any {
    // Basic event handler - can be expanded later
    // For now, just return the payload type for logging
    return { eventType: payload.type };
  }
}

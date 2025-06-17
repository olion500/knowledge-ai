export interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  text: string;
  timestamp: string;
  threadTs?: string;
  reactions?: SlackReaction[];
  files?: SlackFile[];
}

export interface SlackReaction {
  name: string;
  count: number;
  users: string[];
}

export interface SlackFile {
  id: string;
  name: string;
  mimetype: string;
  url: string;
  size: number;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  members?: string[];
}

export interface SlackUser {
  id: string;
  name: string;
  realName: string;
  email?: string;
  isBot: boolean;
}

export interface SlackEvent {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  eventTs: string;
  channelType: string;
  // Properties for reaction_added event
  reaction?: string;
  item?: {
    type: string;
    channel: string;
    ts: string;
  };
}

export interface SlackEventPayload {
  token: string;
  teamId: string;
  apiAppId: string;
  event: SlackEvent;
  type: string;
  eventId: string;
  eventTime: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  issueType: string;
  status: string;
  priority: string;
  assignee?: JiraUser;
  reporter: JiraUser;
  project: JiraProject;
  epic?: JiraEpic;
  components: JiraComponent[];
  labels: string[];
  created: string;
  updated: string;
  comments: JiraComment[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraEpic {
  id: string;
  key: string;
  name: string;
  summary: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string;
  created: string;
  updated: string;
}

export interface JiraWebhookEvent {
  timestamp: number;
  webhookEvent: string;
  issue_event_type_name?: string;
  user: JiraUser;
  issue: JiraIssue;
  changelog?: JiraChangelog;
  comment?: JiraComment;
}

export interface JiraChangelog {
  id: string;
  items: JiraChangelogItem[];
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  from: string;
  fromString: string;
  to: string;
  toString: string;
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JiraIssue,
  JiraWebhookEvent,
} from '../../common/interfaces/jira.interface';
import { DocumentService } from '../document/document.service';

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);
  private readonly jiraHost: string;
  private readonly jiraUsername: string;
  private readonly jiraApiToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
  ) {
    this.jiraHost = this.configService.get<string>('JIRA_HOST')!;
    this.jiraUsername = this.configService.get<string>('JIRA_USERNAME')!;
    this.jiraApiToken = this.configService.get<string>('JIRA_API_TOKEN')!;
  }

  async processWebhookEvent(event: JiraWebhookEvent): Promise<void> {
    this.logger.log(`Processing Jira webhook event: ${event.webhookEvent}`);

    try {
      // Only process issue-related events
      if (this.isIssueEvent(event.webhookEvent) && event.issue) {
        if (this.shouldProcessIssue(event.issue)) {
          await this.processIssueForDocumentation(event.issue);
        } else {
          this.logger.debug(
            `Skipping issue ${event.issue.key} - does not meet processing criteria`,
          );
        }
      } else {
        this.logger.debug(`Ignoring non-issue event: ${event.webhookEvent}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process Jira webhook event`, error);
      throw error;
    }
  }

  private isIssueEvent(webhookEvent: string): boolean {
    const issueEvents = [
      'jira:issue_created',
      'jira:issue_updated',
      'jira:issue_deleted',
      'issue_commented',
    ];
    return issueEvents.includes(webhookEvent);
  }

  private shouldProcessIssue(issue: JiraIssue): boolean {
    // Process high priority issues
    if (['Highest', 'High'].includes(issue.priority)) {
      return true;
    }

    // Process specific issue types
    if (['Epic', 'Story', 'Bug'].includes(issue.issueType)) {
      return true;
    }

    // Process issues with specific labels
    const importantLabels = [
      'documentation',
      'decision',
      'architecture',
      'security',
      'performance',
      'breaking-change',
      'feature',
      'critical',
    ];

    const hasImportantLabel = issue.labels.some((label) =>
      importantLabels.some((important) =>
        label.toLowerCase().includes(important.toLowerCase()),
      ),
    );

    if (hasImportantLabel) {
      return true;
    }

    // Process issues with many comments (indicates discussion)
    if (issue.comments.length >= 3) {
      return true;
    }

    return false;
  }

  private async processIssueForDocumentation(issue: JiraIssue): Promise<void> {
    this.logger.log(`Processing Jira issue for documentation: ${issue.key}`);

    try {
      await this.documentService.processJiraIssue(issue);
      this.logger.log(`Successfully processed Jira issue: ${issue.key}`);
    } catch (error) {
      this.logger.error(`Failed to process Jira issue ${issue.key}`, error);
      throw error;
    }
  }

  private extractIssueContent(issue: JiraIssue): string {
    let content = `Issue: ${issue.key} - ${issue.summary}\n`;
    content += `Type: ${issue.issueType}\n`;
    content += `Priority: ${issue.priority}\n`;
    content += `Status: ${issue.status}\n`;
    content += `Reporter: ${issue.reporter.displayName}\n`;

    if (issue.assignee) {
      content += `Assignee: ${issue.assignee.displayName}\n`;
    }

    if (issue.description) {
      content += `\nDescription:\n${issue.description}\n`;
    }

    if (issue.components.length > 0) {
      content += `\nComponents: ${issue.components.map((c) => c.name).join(', ')}\n`;
    }

    if (issue.labels.length > 0) {
      content += `Labels: ${issue.labels.join(', ')}\n`;
    }

    if (issue.comments.length > 0) {
      content += '\nComments:\n';
      issue.comments.forEach((comment) => {
        content += `[${comment.author.displayName}]: ${comment.body}\n`;
      });
    }

    return content;
  }

  async getIssue(issueKey: string): Promise<JiraIssue | null> {
    try {
      // This would make an actual API call to Jira
      // For now, we'll return null as this is primarily for webhook processing
      this.logger.log(`Getting Jira issue: ${issueKey}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get Jira issue ${issueKey}`, error);
      return null;
    }
  }
}

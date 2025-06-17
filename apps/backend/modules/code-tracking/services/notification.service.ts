import { Injectable, Logger, Inject } from '@nestjs/common';
// import { SlackService } from '../../slack/services/slack.service';

// Temporary interface until SlackService is available
interface SlackService {
  sendMessage(payload: any): Promise<any>;
  sendCodeChangeNotification(payload: any): Promise<any>;
}
import {
  NotificationPayload,
  ConflictResolution,
} from '../../../common/interfaces/code-tracking.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject('SlackService') private readonly slackService: SlackService,
  ) {}

  async sendChangeNotification(payload: NotificationPayload): Promise<void> {
    try {
      const message = this.formatChangeMessage(
        payload.referenceId,
        payload.changeType,
        payload.oldContent,
        payload.newContent,
      );

      await this.slackService.sendCodeChangeNotification({
        type: 'code_change',
        referenceId: payload.referenceId,
        documentId: payload.documentId,
        changeType: payload.changeType,
        oldContent: payload.oldContent,
        newContent: payload.newContent,
        message,
      });

      this.logger.log(
        `Sent change notification for reference: ${payload.referenceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send change notification for ${payload.referenceId}:`,
        error,
      );
      // Don't throw - notifications should not break the main flow
    }
  }

  async sendConflictNotification(payload: NotificationPayload): Promise<void> {
    if (!payload.conflictResolution) {
      this.logger.warn(
        'No conflict resolution provided for conflict notification',
      );
      return;
    }

    try {
      const message = this.formatConflictMessage(
        payload.referenceId,
        payload.conflictResolution.conflictType,
        payload.conflictResolution.resolution,
      );

      await this.slackService.sendCodeChangeNotification({
        type: 'conflict',
        referenceId: payload.referenceId,
        documentId: payload.documentId,
        changeType: payload.changeType,
        oldContent: payload.oldContent,
        conflictType: payload.conflictResolution.conflictType,
        resolution: payload.conflictResolution.resolution,
        newContent: payload.conflictResolution.newContent,
        newStartLine: payload.conflictResolution.newStartLine,
        newEndLine: payload.conflictResolution.newEndLine,
        message,
      });

      this.logger.log(
        `Sent conflict notification for reference: ${payload.referenceId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send conflict notification for ${payload.referenceId}:`,
        error,
      );
      // Don't throw - notifications should not break the main flow
    }
  }

  formatChangeMessage(
    referenceId: string,
    changeType: string,
    oldContent: string,
    newContent?: string,
  ): string {
    const maxContentLength = 200;

    const truncate = (content: string) =>
      content.length > maxContentLength
        ? content.substring(0, maxContentLength) + '...'
        : content;

    let message = `🔄 Code reference ${referenceId} has been ${changeType}.`;

    if (changeType === 'deleted') {
      message += `\n\n📋 Original content:\n\`\`\`\n${truncate(oldContent)}\n\`\`\``;
    } else if (changeType === 'modified' && newContent) {
      message += `\n\n📋 Old content:\n\`\`\`\n${truncate(oldContent)}\n\`\`\``;
      message += `\n\n📝 New content:\n\`\`\`\n${truncate(newContent)}\n\`\`\``;
    } else {
      message += `\n\n📋 Content:\n\`\`\`\n${truncate(oldContent)}\n\`\`\``;
    }

    return message;
  }

  formatConflictMessage(
    referenceId: string,
    conflictType: string,
    resolution: string,
  ): string {
    let message = `⚠️ Code conflict detected for reference ${referenceId}.`;
    message += `\n\n🔍 Conflict type: ${conflictType}`;

    switch (resolution) {
      case 'manual':
        message += '\n\n🛠️ Resolution required: Manual intervention needed';
        message += '\nPlease review and update the affected documentation.';
        break;
      case 'auto':
        message += '\n\n✅ Resolution required: Automatically resolved';
        message += '\nThe code reference has been automatically updated.';
        break;
      case 'ignore':
        message += '\n\n🚫 Resolution required: Ignored';
        message += '\nThe conflict has been marked as ignored.';
        break;
      default:
        message += `\n\n❓ Resolution required: ${resolution}`;
    }

    return message;
  }

  async sendBulkNotifications(payloads: NotificationPayload[]): Promise<void> {
    this.logger.log(`Sending ${payloads.length} bulk notifications`);

    const notifications = payloads.map(async (payload) => {
      try {
        if (payload.conflictResolution) {
          await this.sendConflictNotification(payload);
        } else {
          await this.sendChangeNotification(payload);
        }
      } catch (error) {
        this.logger.error(
          `Failed to send notification for ${payload.referenceId}:`,
          error,
        );
        // Continue with other notifications
      }
    });

    await Promise.allSettled(notifications);
    this.logger.log('Completed bulk notification sending');
  }

  async sendRepositoryChangesSummary(
    repository: string,
    totalChanges: number,
    affectedReferences: number,
  ): Promise<void> {
    try {
      const message =
        `📊 Repository Update Summary\n\n` +
        `🔗 Repository: ${repository}\n` +
        `📝 Total changes: ${totalChanges}\n` +
        `🎯 Affected code references: ${affectedReferences}\n\n` +
        `All code references have been processed and updated.`;

      await this.slackService.sendMessage({
        text: message,
        channel: '#code-tracking', // Configure this as needed
      });

      this.logger.log(`Sent repository changes summary for ${repository}`);
    } catch (error) {
      this.logger.error(
        `Failed to send repository changes summary for ${repository}:`,
        error,
      );
    }
  }
}

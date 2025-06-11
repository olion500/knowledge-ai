import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { CodeChangeEvent, ChangeType, ProcessingStatus } from '../../../common/entities/code-change-event.entity';
import { CodeReference } from '../../../common/entities/code-reference.entity';
import { SmartCodeTrackingService } from './smart-code-tracking.service';

@Injectable()
export class GitHubWebhookService {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(
    @InjectRepository(CodeChangeEvent)
    private readonly codeChangeEventRepository: Repository<CodeChangeEvent>,
    @InjectRepository(CodeReference)
    private readonly codeReferenceRepository: Repository<CodeReference>,
    private readonly smartTrackingService: SmartCodeTrackingService,
  ) {}

  async handlePushEvent(payload: any): Promise<void> {
    this.logger.log(`Processing push event for repository: ${payload.repository.full_name}`);

    const repository = payload.repository.full_name;
    const commits = payload.commits || [];

    if (commits.length === 0) {
      this.logger.warn('No commits in push event');
      return;
    }

    // Get all code references for this repository
    const [owner, repo] = repository.split('/');
    const allReferences = await this.codeReferenceRepository.find({
      where: { 
        repositoryOwner: owner,
        repositoryName: repo,
      },
    });

    for (const commit of commits) {
      await this.processCommitChanges(repository, commit, allReferences);
    }
  }

  async handlePullRequestEvent(payload: any): Promise<void> {
    this.logger.log(`Processing pull request event for repository: ${payload.repository.full_name}`);

    const { action, pull_request } = payload;
    const repository = payload.repository.full_name;

    // Only process opened, synchronize (updated), and closed PR events
    if (!['opened', 'synchronize', 'closed'].includes(action)) {
      this.logger.log(`Ignoring PR action: ${action}`);
      return;
    }

    // For merged PRs, process the merge commit
    if (action === 'closed' && pull_request.merged) {
      await this.handleMergedPR(repository, pull_request);
      return;
    }

    // For opened/updated PRs, analyze the changes
    if (action === 'opened' || action === 'synchronize') {
      await this.analyzePRChanges(repository, pull_request);
    }
  }

  private async handleMergedPR(repository: string, pullRequest: any): Promise<void> {
    this.logger.log(`Processing merged PR #${pullRequest.number} in ${repository}`);
    
    // Get the merge commit SHA
    const mergeCommitSha = pullRequest.merge_commit_sha;
    if (!mergeCommitSha) {
      this.logger.warn('No merge commit SHA found for merged PR');
      return;
    }

    // Create a synthetic commit event for the merge
    const syntheticCommit = {
      id: mergeCommitSha,
      timestamp: pullRequest.merged_at,
      message: `Merge pull request #${pullRequest.number} from ${pullRequest.head.ref}`,
      added: [], // This would need to be fetched from GitHub API
      removed: [],
      modified: [],
    };

    // Get all code references for this repository
    const [owner, repo] = repository.split('/');
    const allReferences = await this.codeReferenceRepository.find({
      where: { 
        repositoryOwner: owner,
        repositoryName: repo,
      },
    });

    await this.processCommitChanges(repository, syntheticCommit, allReferences);
  }

  private async analyzePRChanges(repository: string, pullRequest: any): Promise<void> {
    this.logger.log(`Analyzing PR #${pullRequest.number} changes in ${repository}`);
    
    // This is where we could implement PR change analysis
    // For now, we'll log the event for future implementation
    this.logger.log(`PR #${pullRequest.number} - Head: ${pullRequest.head.sha}, Base: ${pullRequest.base.sha}`);
    
    // TODO: Implement PR diff analysis
    // - Fetch PR diff from GitHub API
    // - Analyze changed files
    // - Check if any referenced code is affected
    // - Create preview of documentation updates needed
  }

  private async processCommitChanges(
    repository: string,
    commit: any,
    allReferences: CodeReference[],
  ): Promise<void> {
    const { id: commitHash, timestamp, added = [], removed = [], modified = [] } = commit;

    // Process added files
    for (const filePath of added) {
      const affectedReferences = this.findReferencesForFile(allReferences, filePath);
      if (affectedReferences.length > 0) {
        await this.createChangeEvent({
          repository,
          filePath,
          changeType: ChangeType.MODIFIED, // New files are treated as modifications
          commitHash,
          timestamp: new Date(timestamp),
          affectedReferences,
        });
      }
    }

    // Process removed files
    for (const filePath of removed) {
      const affectedReferences = this.findReferencesForFile(allReferences, filePath);
      if (affectedReferences.length > 0) {
        await this.createChangeEvent({
          repository,
          filePath,
          changeType: ChangeType.DELETED,
          commitHash,
          timestamp: new Date(timestamp),
          affectedReferences,
        });
      }
    }

    // Process modified files
    for (const filePath of modified) {
      const affectedReferences = this.findReferencesForFile(allReferences, filePath);
      if (affectedReferences.length > 0) {
        await this.createChangeEvent({
          repository,
          filePath,
          changeType: ChangeType.MODIFIED,
          commitHash,
          timestamp: new Date(timestamp),
          affectedReferences,
        });
      }
    }
  }

  private findReferencesForFile(references: CodeReference[], filePath: string): string[] {
    return references
      .filter(ref => ref.filePath === filePath)
      .map(ref => ref.id);
  }

  private async createChangeEvent(eventData: {
    repository: string;
    filePath: string;
    changeType: ChangeType;
    commitHash: string;
    timestamp: Date;
    affectedReferences: string[];
    oldFilePath?: string;
    oldContent?: string;
    newContent?: string;
  }): Promise<void> {
    const changeEvent = this.codeChangeEventRepository.create({
      repository: eventData.repository,
      filePath: eventData.filePath,
      changeType: eventData.changeType,
      commitHash: eventData.commitHash,
      timestamp: eventData.timestamp,
      affectedReferences: eventData.affectedReferences,
      oldFilePath: eventData.oldFilePath,
      oldContent: eventData.oldContent,
      newContent: eventData.newContent,
      processingStatus: ProcessingStatus.PENDING,
    });

    await this.codeChangeEventRepository.save(changeEvent);
    this.logger.log(`Created change event for ${eventData.filePath} in ${eventData.repository}`);
  }

  async processChangeEvent(changeEvent: CodeChangeEvent): Promise<void> {
    this.logger.log(`Processing change event ${changeEvent.id}`);

    try {
      changeEvent.markAsProcessing();
      await this.codeChangeEventRepository.save(changeEvent);

      await this.smartTrackingService.processCodeChange(changeEvent);

      changeEvent.markAsCompleted();
      await this.codeChangeEventRepository.save(changeEvent);

      this.logger.log(`Successfully processed change event ${changeEvent.id}`);
    } catch (error) {
      this.logger.error(`Failed to process change event ${changeEvent.id}:`, error);
      changeEvent.markAsFailed(error.message);
      await this.codeChangeEventRepository.save(changeEvent);
    }
  }

  async findAffectedReferences(repository: string, filePaths: string[]): Promise<string[]> {
    const [owner, repo] = repository.split('/');
    const references = await this.codeReferenceRepository.find({
      where: { 
        repositoryOwner: owner,
        repositoryName: repo,
      },
    });

    return references
      .filter(ref => filePaths.includes(ref.filePath))
      .map(ref => ref.id);
  }

  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Ensure both signatures have the same length before comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  async getPendingEvents(): Promise<CodeChangeEvent[]> {
    return this.codeChangeEventRepository.find({
      where: { processingStatus: ProcessingStatus.PENDING },
      order: { timestamp: 'ASC' },
      take: 50,
    });
  }

  async processPendingEvents(): Promise<void> {
    const pendingEvents = await this.getPendingEvents();
    
    this.logger.log(`Processing ${pendingEvents.length} pending events`);

    for (const event of pendingEvents) {
      if (event.isProcessable()) {
        await this.processChangeEvent(event);
      }
    }
  }
} 
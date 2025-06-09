import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository as TypeOrmRepository,
  MoreThan,
  LessThanOrEqual,
} from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncJob } from '../../common/entities/sync-job.entity';
import { Repository } from '../../common/entities/repository.entity';
import { RepositoryService } from '../repository/repository.service';
import { CodeAnalysisService } from '../code-analysis/code-analysis.service';
import { GitHubService } from '../github/github.service';
import { CodeAnalysisLLMService } from '../code-analysis/services/code-analysis-llm.service';
import { DocumentationUpdate } from '../../common/entities/documentation-update.entity';
import {
  SyncResult,
  SyncConfig,
  CommitInfo,
  SyncProgress,
} from '../../common/interfaces/sync.interface';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly activeSyncJobs = new Map<string, SyncProgress>();
  private readonly defaultSyncConfig: SyncConfig = {
    enabled: true,
    schedule: '0 6 * * *', // Daily at 6 AM
    maxRetries: 3,
    retryDelay: 60000, // 1 minute
    timeout: 3600000, // 1 hour
    concurrentJobs: 3,
    webhookEnabled: false,
  };

  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobRepository: TypeOrmRepository<SyncJob>,
    @InjectRepository(Repository)
    private readonly repositoryRepository: TypeOrmRepository<Repository>,
    @InjectRepository(DocumentationUpdate)
    private readonly documentationUpdateRepository: TypeOrmRepository<DocumentationUpdate>,
    private readonly repositoryService: RepositoryService,
    private readonly codeAnalysisService: CodeAnalysisService,
    private readonly githubService: GitHubService,
    private readonly codeAnalysisLLMService: CodeAnalysisLLMService,
  ) {}

  /**
   * Scheduled sync job - runs daily at 6 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailySync(): Promise<void> {
    this.logger.log('Starting daily sync for all repositories');

    try {
      const repositories = await this.repositoryRepository.find({
        where: {
          active: true,
        },
      });

      // Filter repositories that have sync enabled and daily frequency
      const syncEnabledRepos = repositories.filter(
        (repo) =>
          repo.syncConfig?.enabled !== false &&
          (repo.syncConfig?.syncFrequency === 'daily' ||
            !repo.syncConfig?.syncFrequency),
      );

      const syncPromises = syncEnabledRepos.map((repo) =>
        this.syncRepository(repo.id, 'scheduled'),
      );

      await Promise.allSettled(syncPromises);
      this.logger.log(
        `Daily sync completed for ${syncEnabledRepos.length} repositories`,
      );
    } catch (error) {
      this.logger.error('Failed to run daily sync', error);
    }
  }

  /**
   * Sync a specific repository
   */
  async syncRepository(
    repositoryId: string,
    type: 'scheduled' | 'manual' | 'webhook' = 'manual',
  ): Promise<SyncResult> {
    const jobId = await this.createSyncJob(repositoryId, type);

    try {
      const result = await this.executeSyncJob(jobId);
      await this.completeSyncJob(jobId, result);
      return result;
    } catch (error: any) {
      this.logger.error(`Failed to sync repository ${repositoryId}`, error);
      await this.failSyncJob(jobId, error.message);
      throw error;
    }
  }

  /**
   * Create a new sync job
   */
  async createSyncJob(
    repositoryId: string,
    type: 'scheduled' | 'manual' | 'webhook',
  ): Promise<string> {
    const repository = await this.repositoryRepository.findOne({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    // Check for existing running jobs
    const existingJob = await this.syncJobRepository.findOne({
      where: {
        repositoryId,
        status: 'running',
      },
    });

    if (existingJob) {
      throw new Error(
        `Sync job already running for repository ${repositoryId}`,
      );
    }

    const syncJob = this.syncJobRepository.create({
      repositoryId,
      type,
      status: 'pending',
      metadata: {},
    });

    const savedJob = await this.syncJobRepository.save(syncJob);
    this.logger.log(
      `Created sync job ${savedJob.id} for repository ${repositoryId}`,
    );

    return savedJob.id;
  }

  /**
   * Execute sync job
   */
  private async executeSyncJob(jobId: string): Promise<SyncResult> {
    const job = await this.syncJobRepository.findOne({
      where: { id: jobId },
      relations: ['repository'],
    });

    if (!job) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    const startTime = new Date();
    job.updateStatus('running');
    await this.syncJobRepository.save(job);

    this.logger.log(
      `Starting sync job ${jobId} for repository ${job.repository.fullName}`,
    );

    // Initialize progress tracking
    const progress: SyncProgress = {
      jobId,
      stage: 'initializing',
      progress: 0,
      processedFiles: 0,
      totalFiles: 0,
    };
    this.activeSyncJobs.set(jobId, progress);

    try {
      // 1. Get latest commits
      progress.stage = 'fetching_commits';
      progress.progress = 10;
      this.activeSyncJobs.set(jobId, progress);

      const commits = await this.getNewCommits(job.repository);

      if (commits.length === 0) {
        this.logger.log(
          `No new commits found for repository ${job.repository.fullName}`,
        );
        return this.createSyncResult(
          jobId,
          job.repository,
          startTime,
          new Date(),
          {
            totalFiles: 0,
            analyzedFiles: 0,
            newFunctions: 0,
            modifiedFunctions: 0,
            deletedFunctions: 0,
            errors: 0,
          },
          commits,
        );
      }

      // 2. Analyze repository with new commit
      progress.stage = 'analyzing_files';
      progress.progress = 30;
      this.activeSyncJobs.set(jobId, progress);

      const latestCommit = commits[0];
      const analysisResult = await this.codeAnalysisService.analyzeRepository(
        job.repositoryId,
        latestCommit.sha,
      );

      progress.totalFiles = analysisResult.totalFiles;
      progress.processedFiles = analysisResult.analyzedFiles;
      progress.progress = 70;
      this.activeSyncJobs.set(jobId, progress);

      // 3. Compare with previous version if available
      let changeComparison;
      if (
        job.repository.lastCommitSha &&
        job.repository.lastCommitSha !== latestCommit.sha
      ) {
        changeComparison = await this.codeAnalysisService.compareCommits(
          job.repositoryId,
          job.repository.lastCommitSha,
          latestCommit.sha,
        );

        // 3.1. Analyze changes with LLM for documentation updates
        if (
          changeComparison &&
          (changeComparison.added.length > 0 ||
            changeComparison.modified.length > 0 ||
            changeComparison.deleted.length > 0)
        ) {
          try {
            await this.analyzeChangesForDocumentation(
              jobId,
              job.repository,
              changeComparison,
              commits,
            );
          } catch (error: any) {
            this.logger.warn(
              `Failed to analyze changes for documentation: ${error.message}`,
            );
          }
        }
      }

      // 4. Update repository with latest commit
      progress.stage = 'saving_results';
      progress.progress = 90;
      this.activeSyncJobs.set(jobId, progress);

      // Update repository last commit directly
      await this.repositoryRepository.update(job.repositoryId, {
        lastCommitSha: latestCommit.sha,
        lastSyncedAt: new Date(),
      });

      // 5. Update job metadata
      job.metadata = {
        ...job.metadata,
        fromCommit: job.repository.lastCommitSha,
        toCommit: latestCommit.sha,
        filesAnalyzed: analysisResult.analyzedFiles,
        functionsFound: analysisResult.functions,
        changesDetected: changeComparison
          ? changeComparison.added.length +
            changeComparison.modified.length +
            changeComparison.deleted.length
          : 0,
        totalFiles: analysisResult.totalFiles,
      };

      await this.syncJobRepository.save(job);

      progress.stage = 'completed';
      progress.progress = 100;
      this.activeSyncJobs.set(jobId, progress);

      const endTime = new Date();
      const result = this.createSyncResult(
        jobId,
        job.repository,
        startTime,
        endTime,
        {
          totalFiles: analysisResult.totalFiles,
          analyzedFiles: analysisResult.analyzedFiles,
          newFunctions: changeComparison?.added.length || 0,
          modifiedFunctions: changeComparison?.modified.length || 0,
          deletedFunctions: changeComparison?.deleted.length || 0,
          errors: analysisResult.errors.length,
        },
        commits,
      );

      this.logger.log(`Sync job ${jobId} completed successfully`);
      return result;
    } finally {
      this.activeSyncJobs.delete(jobId);
    }
  }

  /**
   * Get new commits since last sync
   */
  private async getNewCommits(repository: Repository): Promise<CommitInfo[]> {
    try {
      const commits = await this.githubService.getCommits(
        repository.owner,
        repository.name,
        {
          since: repository.lastSyncedAt?.toISOString(),
          sha: repository.syncConfig?.branch || repository.defaultBranch,
          per_page: 100,
        },
      );

      return commits.map((commit) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
        },
        committer: {
          name: commit.commit.committer.name,
          email: commit.commit.committer.email,
          date: commit.commit.committer.date,
        },
        url: commit.html_url,
        stats: commit.stats
          ? {
              additions: commit.stats.additions,
              deletions: commit.stats.deletions,
              total: commit.stats.total,
            }
          : undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get commits for ${repository.fullName}`,
        error,
      );
      return [];
    }
  }

  /**
   * Complete sync job with success
   */
  private async completeSyncJob(
    jobId: string,
    result: SyncResult,
  ): Promise<void> {
    const job = await this.syncJobRepository.findOne({ where: { id: jobId } });
    if (job) {
      job.updateStatus('completed');
      await this.syncJobRepository.save(job);
    }
  }

  /**
   * Mark sync job as failed
   */
  private async failSyncJob(jobId: string, error: string): Promise<void> {
    const job = await this.syncJobRepository.findOne({ where: { id: jobId } });
    if (job) {
      job.updateStatus('failed', error);

      if (job.canRetry) {
        job.incrementRetry();
        job.updateStatus('pending');
        this.logger.warn(
          `Sync job ${jobId} failed, scheduled for retry ${job.retryCount}/${job.maxRetries}`,
        );
      } else {
        this.logger.error(`Sync job ${jobId} failed permanently: ${error}`);
      }

      await this.syncJobRepository.save(job);
    }
  }

  /**
   * Create sync result object
   */
  private createSyncResult(
    jobId: string,
    repository: Repository,
    startTime: Date,
    endTime: Date,
    summary: SyncResult['summary'],
    commits: CommitInfo[],
  ): SyncResult {
    return {
      jobId,
      repositoryId: repository.id,
      success: true,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      summary,
      commits: {
        from: repository.lastCommitSha || '',
        to: commits[0]?.sha || '',
        count: commits.length,
      },
    };
  }

  /**
   * Get sync job status
   */
  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    return this.syncJobRepository.findOne({
      where: { id: jobId },
      relations: ['repository'],
    });
  }

  /**
   * Get sync jobs for repository
   */
  async getSyncJobs(
    repositoryId: string,
    limit: number = 10,
  ): Promise<SyncJob[]> {
    return this.syncJobRepository.find({
      where: { repositoryId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['repository'],
    });
  }

  /**
   * Get sync progress
   */
  getSyncProgress(jobId: string): SyncProgress | null {
    return this.activeSyncJobs.get(jobId) || null;
  }

  /**
   * Cancel sync job
   */
  async cancelSyncJob(jobId: string): Promise<void> {
    const job = await this.syncJobRepository.findOne({ where: { id: jobId } });

    if (job && job.status === 'running') {
      job.updateStatus('cancelled');
      await this.syncJobRepository.save(job);
      this.activeSyncJobs.delete(jobId);
      this.logger.log(`Sync job ${jobId} cancelled`);
    }
  }

  /**
   * Analyze changes for documentation updates using LLM
   */
  private async analyzeChangesForDocumentation(
    syncJobId: string,
    repository: Repository,
    changes: {
      added: any[];
      modified: any[];
      deleted: any[];
    },
    commits: any[],
  ): Promise<void> {
    this.logger.log(
      `Analyzing changes for documentation updates: ${repository.fullName}`,
    );

    try {
      // Analyze with LLM
      const analysisResult =
        await this.codeAnalysisLLMService.analyzeCodeChangesForDocumentation(
          repository,
          changes,
          commits,
        );

      // Only create documentation update if LLM recommends it
      if (analysisResult.shouldUpdate && analysisResult.confidence > 30) {
        await this.createDocumentationUpdate(
          syncJobId,
          repository,
          analysisResult,
          changes,
          commits,
        );
      } else {
        this.logger.log(
          `LLM analysis suggests no documentation update needed for ${repository.fullName} ` +
            `(confidence: ${analysisResult.confidence}%)`,
        );
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to analyze changes for documentation: ${error.message}`,
      );
    }
  }

  /**
   * Create documentation update record
   */
  private async createDocumentationUpdate(
    syncJobId: string,
    repository: Repository,
    analysisResult: any,
    changes: any,
    commits: any[],
  ): Promise<void> {
    // Determine update type
    let updateType: 'readme' | 'api_docs' | 'changelog' | 'multiple' =
      'changelog';
    let priority =
      analysisResult.suggestedUpdates.changelog?.priority || 'medium';

    const updates = analysisResult.suggestedUpdates;
    const updateCount = [
      updates.readme?.shouldUpdate,
      updates.apiDocs?.shouldUpdate,
      updates.changelog?.shouldUpdate,
    ].filter(Boolean).length;

    if (updateCount > 1) {
      updateType = 'multiple';
      priority = 'high';
    } else if (updates.readme?.shouldUpdate) {
      updateType = 'readme';
      priority = updates.readme.priority;
    } else if (updates.apiDocs?.shouldUpdate) {
      updateType = 'api_docs';
      priority = updates.apiDocs.priority;
    }

    const documentationUpdate = this.documentationUpdateRepository.create({
      repositoryId: repository.id,
      syncJobId,
      status: 'pending',
      priority: priority as 'low' | 'medium' | 'high',
      updateType,
      confidence: analysisResult.confidence,
      reasoning: analysisResult.reasoning,
      analysisResult,
      changeContext: {
        commits: {
          from: commits[commits.length - 1]?.sha || '',
          to: commits[0]?.sha || '',
          count: commits.length,
        },
        changes: {
          added: changes.added.length,
          modified: changes.modified.length,
          deleted: changes.deleted.length,
        },
        complexity: {
          average: 0, // Could be calculated from changes
          highest: 0,
        },
      },
    });

    // Set due date based on priority
    documentationUpdate.setDueDate();

    await this.documentationUpdateRepository.save(documentationUpdate);

    this.logger.log(
      `Created documentation update recommendation for ${repository.fullName} ` +
        `(type: ${updateType}, priority: ${priority}, confidence: ${analysisResult.confidence}%)`,
    );
  }

  /**
   * Get pending documentation updates
   */
  async getPendingDocumentationUpdates(
    repositoryId?: string,
    priority?: 'low' | 'medium' | 'high',
  ): Promise<DocumentationUpdate[]> {
    const where: any = { status: 'pending' };

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    if (priority) {
      where.priority = priority;
    }

    return this.documentationUpdateRepository.find({
      where,
      order: {
        priority: 'DESC',
        confidence: 'DESC',
        createdAt: 'ASC',
      },
      relations: ['repository', 'syncJob'],
      take: 50,
    });
  }

  /**
   * Retry failed sync jobs
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async retryFailedJobs(): Promise<void> {
    const failedJobs = await this.syncJobRepository.find({
      where: {
        status: 'pending',
        retryCount: MoreThan(0),
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      take: 5, // Limit concurrent retries
    });

    for (const job of failedJobs) {
      if (job.canRetry) {
        this.logger.log(`Retrying sync job ${job.id}`);
        try {
          const result = await this.executeSyncJob(job.id);
          await this.completeSyncJob(job.id, result);
        } catch (error: any) {
          await this.failSyncJob(job.id, error.message);
        }
      }
    }
  }
}

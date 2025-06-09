import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncProgress } from '../../common/interfaces/sync.interface';
import { SyncJob } from '../../common/entities/sync-job.entity';
import { DocumentationUpdate } from '../../common/entities/documentation-update.entity';

export class TriggerSyncDto {
  repositoryId: string;
  type?: 'manual' | 'webhook' = 'manual';
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Trigger manual sync for a repository
   */
  @Post('trigger')
  async triggerSync(@Body() dto: TriggerSyncDto): Promise<{
    jobId: string;
    message: string;
  }> {
    try {
      const result = await this.syncService.syncRepository(
        dto.repositoryId,
        dto.type,
      );
      return {
        jobId: result.jobId,
        message: 'Sync completed successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to sync repository: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get sync job details
   */
  @Get('jobs/:jobId')
  async getSyncJob(@Param('jobId') jobId: string): Promise<SyncJob> {
    const job = await this.syncService.getSyncJob(jobId);

    if (!job) {
      throw new HttpException('Sync job not found', HttpStatus.NOT_FOUND);
    }

    return job;
  }

  /**
   * Get sync jobs for a repository
   */
  @Get('repositories/:repositoryId/jobs')
  async getRepositorySyncJobs(
    @Param('repositoryId') repositoryId: string,
    @Query('limit') limit: string = '10',
  ): Promise<SyncJob[]> {
    return this.syncService.getSyncJobs(repositoryId, parseInt(limit, 10));
  }

  /**
   * Get sync job progress
   */
  @Get('jobs/:jobId/progress')
  getSyncProgress(@Param('jobId') jobId: string): Promise<SyncProgress | null> {
    return this.syncService.getSyncProgress(jobId);
  }

  /**
   * Cancel a running sync job
   */
  @Delete('jobs/:jobId')
  async cancelSyncJob(@Param('jobId') jobId: string): Promise<{
    message: string;
  }> {
    await this.syncService.cancelSyncJob(jobId);
    return {
      message: 'Sync job cancelled successfully',
    };
  }

  /**
   * Get all active sync jobs
   */
  @Get('jobs')
  getAllSyncJobs(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ): Promise<SyncJob[]> {
    // This would require additional method in service
    // For now, returning empty array
    return Promise.resolve([]);
  }

  /**
   * Sync all repositories (admin only)
   */
  @Post('all')
  async syncAllRepositories(): Promise<{
    message: string;
    triggeredJobs: number;
  }> {
    try {
      // This would trigger sync for all enabled repositories
      // For now, just trigger the daily sync method
      await this.syncService.runDailySync();

      return {
        message: 'Daily sync triggered for all repositories',
        triggeredJobs: 0, // Would need to track actual number
      };
    } catch (error) {
      throw new HttpException(
        `Failed to sync all repositories: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sync statistics
   */
  @Get('stats')
  getSyncStats(): Promise<{
    totalJobs: number;
    runningJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageDuration: number;
  }> {
    // This would require additional service methods
    // For now, returning placeholder data
    return Promise.resolve({
      totalJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageDuration: 0,
    });
  }

  /**
   * Get pending documentation updates
   */
  @Get('documentation-updates')
  async getPendingDocumentationUpdates(
    @Query('repositoryId') repositoryId?: string,
    @Query('priority') priority?: 'low' | 'medium' | 'high',
  ): Promise<DocumentationUpdate[]> {
    return this.syncService.getPendingDocumentationUpdates(
      repositoryId,
      priority,
    );
  }

  /**
   * Get documentation updates for a specific repository
   */
  @Get('repositories/:repositoryId/documentation-updates')
  async getRepositoryDocumentationUpdates(
    @Param('repositoryId') repositoryId: string,
    @Query('status') status?: string,
  ): Promise<DocumentationUpdate[]> {
    return this.syncService.getPendingDocumentationUpdates(repositoryId);
  }
}

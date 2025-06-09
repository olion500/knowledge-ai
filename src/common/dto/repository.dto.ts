import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  IsUrl,
  ValidateNested,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepositorySyncConfigDto {
  @ApiPropertyOptional({
    description: 'Enable sync for this repository',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Branch to sync (defaults to repository default branch)',
  })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({
    description: 'Paths to include in analysis (glob patterns)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includePaths?: string[];

  @ApiPropertyOptional({
    description: 'Paths to exclude from analysis (glob patterns)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePaths?: string[];

  @ApiPropertyOptional({
    description: 'File extensions to analyze',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileExtensions?: string[];

  @ApiPropertyOptional({
    description: 'Sync frequency',
    enum: ['daily', 'weekly', 'manual'],
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'manual'])
  syncFrequency?: 'daily' | 'weekly' | 'manual';

  @ApiPropertyOptional({
    description: 'Enable automatic documentation generation',
  })
  @IsOptional()
  @IsBoolean()
  autoDocGeneration?: boolean;
}

export class CreateRepositoryDto {
  @ApiProperty({
    description: 'Repository owner (GitHub username or organization)',
  })
  @IsString()
  @IsNotEmpty()
  owner: string;

  @ApiProperty({ description: 'Repository name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Repository description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Default branch name', default: 'main' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value || 'main')
  defaultBranch?: string = 'main';

  @ApiPropertyOptional({ description: 'Sync configuration for the repository' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepositorySyncConfigDto)
  syncConfig?: RepositorySyncConfigDto;
}

export class UpdateRepositoryDto {
  @ApiPropertyOptional({ description: 'Repository description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Default branch name' })
  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @ApiPropertyOptional({ description: 'Last synced commit SHA' })
  @IsOptional()
  @IsString()
  lastCommitSha?: string;

  @ApiPropertyOptional({ description: 'Last sync timestamp' })
  @IsOptional()
  lastSyncedAt?: Date;

  @ApiPropertyOptional({ description: 'Whether repository is active for sync' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Sync configuration for the repository' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepositorySyncConfigDto)
  syncConfig?: RepositorySyncConfigDto;
}

export class RepositoryResponseDto {
  @ApiProperty({ description: 'Repository ID' })
  id: string;

  @ApiProperty({ description: 'Repository owner' })
  owner: string;

  @ApiProperty({ description: 'Repository name' })
  name: string;

  @ApiProperty({ description: 'Full repository name (owner/name)' })
  fullName: string;

  @ApiProperty({ description: 'Default branch name' })
  defaultBranch: string;

  @ApiPropertyOptional({ description: 'Repository description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Primary language' })
  language?: string;

  @ApiPropertyOptional({ description: 'Last synced commit SHA' })
  lastCommitSha?: string;

  @ApiPropertyOptional({ description: 'Last sync timestamp' })
  lastSyncedAt?: Date;

  @ApiProperty({ description: 'Whether repository is active' })
  active: boolean;

  @ApiProperty({ description: 'Whether repository is private' })
  isPrivate: boolean;

  @ApiPropertyOptional({ description: 'Sync configuration' })
  syncConfig?: RepositorySyncConfigDto;

  @ApiPropertyOptional({ description: 'Repository metadata' })
  metadata?: {
    stars?: number;
    forks?: number;
    size?: number;
    topics?: string[];
    [key: string]: any;
  };

  @ApiProperty({ description: 'Repository HTML URL' })
  htmlUrl: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class SyncRepositoryDto {
  @ApiPropertyOptional({
    description: 'Force full sync regardless of last sync time',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({ description: 'Specific commit SHA to sync to' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{40}$/, { message: 'Invalid commit SHA format' })
  targetCommitSha?: string;
}

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

  @ApiPropertyOptional({ description: 'Whether repository is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
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

  @ApiProperty({ description: 'Whether repository is active' })
  active: boolean;

  @ApiProperty({ description: 'Whether repository is private' })
  isPrivate: boolean;

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

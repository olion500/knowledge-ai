import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository, FindManyOptions } from 'typeorm';
import { Repository } from '../../common/entities/repository.entity';
import { GitHubService } from '../github/github.service';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  RepositoryResponseDto,
  SyncRepositoryDto,
} from '../../common/dto/repository.dto';
import {
  RepositoryInfo,
  GitHubCommitInfo,
} from '../../common/interfaces/repository.interface';

@Injectable()
export class RepositoryService {
  private readonly logger = new Logger(RepositoryService.name);

  constructor(
    @InjectRepository(Repository)
    private readonly repositoryRepository: TypeOrmRepository<Repository>,
    private readonly githubService: GitHubService,
  ) {}

  async create(
    createRepositoryDto: CreateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    const { owner, name, description, defaultBranch, syncConfig } =
      createRepositoryDto;
    const fullName = `${owner}/${name}`;

    // 중복 체크
    const existingRepo = await this.repositoryRepository.findOne({
      where: { owner, name },
    });

    if (existingRepo) {
      throw new ConflictException(`Repository ${fullName} already exists`);
    }

    // GitHub에서 실제 리포지토리 정보 가져오기
    let repoInfo: RepositoryInfo;
    try {
      repoInfo = await this.fetchRepositoryInfo(owner, name);
    } catch (error) {
      this.logger.error(
        `Failed to fetch repository info for ${fullName}`,
        error,
      );
      throw new BadRequestException(
        `Repository ${fullName} not found or not accessible`,
      );
    }

    // 새 리포지토리 엔티티 생성
    const repository = this.repositoryRepository.create({
      owner,
      name,
      fullName,
      description: description || repoInfo.description,
      defaultBranch: defaultBranch || repoInfo.defaultBranch,
      language: repoInfo.language,
      isPrivate: repoInfo.isPrivate,
      metadata: repoInfo.metadata,
      syncConfig: syncConfig || {
        syncFrequency: 'daily',
        autoDocGeneration: true,
        fileExtensions: [
          '.ts',
          '.js',
          '.py',
          '.java',
          '.cpp',
          '.c',
          '.go',
          '.rs',
        ],
        excludePaths: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      },
      active: true,
    });

    const savedRepository = await this.repositoryRepository.save(repository);
    this.logger.log(
      `Repository ${fullName} created with ID: ${savedRepository.id}`,
    );

    return this.toResponseDto(savedRepository);
  }

  async findAll(options?: {
    active?: boolean;
  }): Promise<RepositoryResponseDto[]> {
    const findOptions: FindManyOptions<Repository> = {
      order: { updatedAt: 'DESC' },
    };

    if (options?.active !== undefined) {
      findOptions.where = { active: options.active };
    }

    const repositories = await this.repositoryRepository.find(findOptions);
    return repositories.map((repo) => this.toResponseDto(repo));
  }

  async findOne(id: string): Promise<RepositoryResponseDto> {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    return this.toResponseDto(repository);
  }

  async findByFullName(
    owner: string,
    name: string,
  ): Promise<RepositoryResponseDto | null> {
    const repository = await this.repositoryRepository.findOne({
      where: { owner, name },
    });

    return repository ? this.toResponseDto(repository) : null;
  }

  async update(
    id: string,
    updateRepositoryDto: UpdateRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    // 업데이트할 필드들 적용
    Object.assign(repository, updateRepositoryDto);

    const updatedRepository = await this.repositoryRepository.save(repository);
    this.logger.log(`Repository ${repository.fullName} updated`);

    return this.toResponseDto(updatedRepository);
  }

  async remove(id: string): Promise<void> {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    await this.repositoryRepository.softDelete(id);
    this.logger.log(`Repository ${repository.fullName} deleted`);
  }

  async syncRepository(
    id: string,
    syncDto?: SyncRepositoryDto,
  ): Promise<RepositoryResponseDto> {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    try {
      // GitHub에서 최신 정보 가져오기
      const repoInfo = await this.fetchRepositoryInfo(
        repository.owner,
        repository.name,
      );
      const latestCommit = await this.getLatestCommit(
        repository.owner,
        repository.name,
        repository.defaultBranch,
      );

      // 강제 동기화가 아니고 이미 최신이면 스킵
      if (!syncDto?.force && repository.lastCommitSha === latestCommit.sha) {
        this.logger.log(
          `Repository ${repository.fullName} is already up to date`,
        );
        return this.toResponseDto(repository);
      }

      // 리포지토리 정보 업데이트
      repository.description = repoInfo.description;
      repository.language = repoInfo.language;
      repository.metadata = repoInfo.metadata;
      repository.lastCommitSha = syncDto?.targetCommitSha || latestCommit.sha;
      repository.lastSyncedAt = new Date();

      const updatedRepository =
        await this.repositoryRepository.save(repository);
      this.logger.log(
        `Repository ${repository.fullName} synced to commit ${repository.lastCommitSha}`,
      );

      return this.toResponseDto(updatedRepository);
    } catch (error: any) {
      this.logger.error(
        `Failed to sync repository ${repository.fullName}`,
        error,
      );
      throw new BadRequestException(
        `Failed to sync repository: ${error.message}`,
      );
    }
  }

  async getActiveRepositories(): Promise<Repository[]> {
    return this.repositoryRepository.find({
      where: { active: true },
      order: { lastSyncedAt: 'ASC' }, // 가장 오래된 것부터
    });
  }

  async getRepositoryFiles(
    id: string,
    path = '',
    branch?: string,
  ): Promise<
    Array<{ name: string; path: string; type: 'file' | 'dir'; size?: number }>
  > {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    try {
      const contents = await this.githubService.listDirectoryContents(
        path,
        branch || repository.defaultBranch,
      );

      return contents.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
      }));
    } catch (error: any) {
      this.logger.error(
        `Failed to get repository files for ${repository.fullName}`,
        error,
      );
      throw new BadRequestException(
        `Failed to get repository files: ${error.message}`,
      );
    }
  }

  async getFileContent(
    id: string,
    filePath: string,
    branch?: string,
  ): Promise<{ content: string; language: string; size: number }> {
    const repository = await this.repositoryRepository.findOne({
      where: { id },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${id} not found`);
    }

    try {
      const fileContent = await this.githubService.getFileContent(
        filePath,
        branch || repository.defaultBranch,
      );

      if (!fileContent || fileContent.type !== 'file') {
        throw new NotFoundException(`File ${filePath} not found`);
      }

      const content = Buffer.from(fileContent.content || '', 'base64').toString(
        'utf-8',
      );
      const language = this.detectLanguage(filePath);

      return {
        content,
        language,
        size: fileContent.size,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get file content for ${filePath} in ${repository.fullName}`,
        error,
      );
      throw new BadRequestException(
        `Failed to get file content: ${error.message}`,
      );
    }
  }

  private async fetchRepositoryInfo(
    owner: string,
    name: string,
  ): Promise<RepositoryInfo> {
    return this.githubService.getRepositoryInfo(owner, name);
  }

  private async getLatestCommit(
    owner: string,
    name: string,
    branch: string,
  ): Promise<GitHubCommitInfo> {
    return this.githubService.getLatestCommit(owner, name, branch);
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      cs: 'csharp',
      kt: 'kotlin',
      swift: 'swift',
      dart: 'dart',
    };

    return languageMap[extension || ''] || 'text';
  }

  private toResponseDto(repository: Repository): RepositoryResponseDto {
    return {
      id: repository.id,
      owner: repository.owner,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch: repository.defaultBranch,
      description: repository.description,
      language: repository.language,
      lastCommitSha: repository.lastCommitSha,
      lastSyncedAt: repository.lastSyncedAt,
      active: repository.active,
      isPrivate: repository.isPrivate,
      syncConfig: repository.syncConfig,
      metadata: repository.metadata,
      htmlUrl: repository.htmlUrl,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    };
  }
}

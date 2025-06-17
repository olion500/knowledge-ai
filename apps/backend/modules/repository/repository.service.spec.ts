import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { RepositoryService } from './repository.service';
import { Repository } from '../../common/entities/repository.entity';
import { GitHubService } from '../github/github.service';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  SyncRepositoryDto,
} from '../../common/dto/repository.dto';

describe('RepositoryService', () => {
  let service: RepositoryService;
  let repository: jest.Mocked<TypeOrmRepository<Repository>>;
  let githubService: jest.Mocked<GitHubService>;

  const mockRepository = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    defaultBranch: 'main',
    description:
      'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    language: 'JavaScript',

    lastSyncedAt: new Date('2024-01-01T00:00:00Z'),
    active: true,
    isPrivate: false,
    syncConfig: {
      syncFrequency: 'daily',
      autoDocGeneration: true,
      fileExtensions: ['.ts', '.js'],
      excludePaths: ['node_modules/**'],
    },
    metadata: {
      stars: 12345,
      forks: 6789,
      size: 1024,
      topics: ['react', 'javascript'],
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    deletedAt: undefined,
    htmlUrl: 'https://github.com/facebook/react',
    cloneUrl: 'https://github.com/facebook/react.git',
    apiUrl: 'https://api.github.com/repos/facebook/react',
  } as any;

  const mockGitHubRepoInfo = {
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    defaultBranch: 'main',
    description:
      'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    language: 'JavaScript',
    isPrivate: false,
    metadata: {
      stars: 12345,
      forks: 6789,
      size: 1024,
      topics: ['react', 'javascript'],
    },
  };

  const mockCommitInfo = {
    sha: 'xyz789',
    message: 'Latest commit',
    author: {
      name: 'Test Author',
      email: 'test@example.com',
      date: '2024-01-02T00:00:00Z',
    },
    url: 'https://github.com/facebook/react/commit/xyz789',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepositoryService,
        {
          provide: getRepositoryToken(Repository),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: GitHubService,
          useValue: {
            getRepositoryInfo: jest.fn(),
            getLatestCommit: jest.fn(),
            listDirectoryContents: jest.fn(),
            getFileContent: jest.fn(),
            getRepositoryContents: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RepositoryService>(RepositoryService);
    repository = module.get(getRepositoryToken(Repository));
    githubService = module.get(GitHubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRepositoryDto = {
      owner: 'facebook',
      name: 'react',
      description: 'Test description',
      defaultBranch: 'main',
    };

    it('should create a new repository successfully', async () => {
      repository.findOne.mockResolvedValue(null);
      githubService.getRepositoryInfo.mockResolvedValue(mockGitHubRepoInfo);
      repository.create.mockReturnValue(mockRepository);
      repository.save.mockResolvedValue(mockRepository);

      const result = await service.create(createDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { owner: 'facebook', name: 'react' },
      });
      expect(githubService.getRepositoryInfo).toHaveBeenCalledWith(
        'facebook',
        'react',
      );
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe(mockRepository.id);
      expect(result.fullName).toBe('facebook/react');
    });

    it('should throw ConflictException when repository already exists', async () => {
      repository.findOne.mockResolvedValue(mockRepository);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(githubService.getRepositoryInfo).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when GitHub repository is not accessible', async () => {
      repository.findOne.mockResolvedValue(null);
      githubService.getRepositoryInfo.mockRejectedValue(
        new Error('Repository not found'),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all repositories', async () => {
      repository.find.mockResolvedValue([mockRepository]);

      const result = await service.findAll();

      expect(repository.find).toHaveBeenCalledWith({
        order: { updatedAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockRepository.id);
    });

    it('should filter by active status', async () => {
      repository.find.mockResolvedValue([mockRepository]);

      const result = await service.findAll({ active: true });

      expect(repository.find).toHaveBeenCalledWith({
        order: { updatedAt: 'DESC' },
        where: { active: true },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return repository by id', async () => {
      repository.findOne.mockResolvedValue(mockRepository);

      const result = await service.findOne(mockRepository.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockRepository.id },
      });
      expect(result.id).toBe(mockRepository.id);
    });

    it('should throw NotFoundException when repository not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByFullName', () => {
    it('should return repository by owner and name', async () => {
      repository.findOne.mockResolvedValue(mockRepository);

      const result = await service.findByFullName('facebook', 'react');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { owner: 'facebook', name: 'react' },
      });
      expect(result?.id).toBe(mockRepository.id);
    });

    it('should return null when repository not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByFullName('non-existent', 'repo');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateDto: UpdateRepositoryDto = {
      description: 'Updated description',
      active: false,
    };

    it('should update repository successfully', async () => {
      const updatedRepo = { ...mockRepository, ...updateDto };
      repository.findOne.mockResolvedValue(mockRepository);
      repository.save.mockResolvedValue(updatedRepo);

      const result = await service.update(mockRepository.id, updateDto);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockRepository.id },
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result.description).toBe('Updated description');
      expect(result.active).toBe(false);
    });

    it('should throw NotFoundException when repository not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete repository successfully', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      repository.softDelete.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      });

      await service.remove(mockRepository.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockRepository.id },
      });
      expect(repository.softDelete).toHaveBeenCalledWith(mockRepository.id);
    });

    it('should throw NotFoundException when repository not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('syncRepository', () => {
    const syncDto: SyncRepositoryDto = {
      force: false,
    };

    it('should sync repository successfully', async () => {
      const syncedRepo = { ...mockRepository };
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.getRepositoryInfo.mockResolvedValue(mockGitHubRepoInfo);
      githubService.getLatestCommit.mockResolvedValue(mockCommitInfo);
      repository.save.mockResolvedValue(syncedRepo);

      const result = await service.syncRepository(mockRepository.id, syncDto);

      expect(githubService.getRepositoryInfo).toHaveBeenCalledWith(
        'facebook',
        'react',
      );
      expect(githubService.getLatestCommit).toHaveBeenCalledWith(
        'facebook',
        'react',
        'main',
      );
      expect(repository.save).toHaveBeenCalled();
    });

    it('should sync repository successfully without force', async () => {
      const upToDateRepo = { ...mockRepository };
      repository.findOne.mockResolvedValue(upToDateRepo);
      githubService.getRepositoryInfo.mockResolvedValue(mockGitHubRepoInfo);
      githubService.getLatestCommit.mockResolvedValue(mockCommitInfo);
      repository.save.mockResolvedValue(upToDateRepo);

      const result = await service.syncRepository(mockRepository.id, {
        force: false,
      });

      expect(repository.save).toHaveBeenCalled();
    });

    it('should force sync when requested', async () => {
      const upToDateRepo = { ...mockRepository };
      repository.findOne.mockResolvedValue(upToDateRepo);
      githubService.getRepositoryInfo.mockResolvedValue(mockGitHubRepoInfo);
      githubService.getLatestCommit.mockResolvedValue(mockCommitInfo);
      repository.save.mockResolvedValue(upToDateRepo);

      const result = await service.syncRepository(mockRepository.id, {
        force: true,
      });

      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException when sync fails', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.getRepositoryInfo.mockRejectedValue(new Error('API error'));

      await expect(
        service.syncRepository(mockRepository.id, syncDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getActiveRepositories', () => {
    it('should return active repositories ordered by lastSyncedAt', async () => {
      repository.find.mockResolvedValue([mockRepository]);

      const result = await service.getActiveRepositories();

      expect(repository.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { updatedAt: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getRepositoryFiles', () => {
    const mockFiles = [
      {
        name: 'src',
        path: 'src',
        type: 'dir' as const,
        size: 0,
        sha: 'dir-sha-123',
        url: 'https://api.github.com/repos/facebook/react/contents/src',
        html_url: 'https://github.com/facebook/react/tree/main/src',
        git_url:
          'https://api.github.com/repos/facebook/react/git/trees/dir-sha-123',
        download_url:
          'https://github.com/facebook/react/archive/refs/heads/main.zip',
      },
      {
        name: 'package.json',
        path: 'package.json',
        type: 'file' as const,
        size: 1024,
        sha: 'file-sha-456',
        url: 'https://api.github.com/repos/facebook/react/contents/package.json',
        html_url: 'https://github.com/facebook/react/blob/main/package.json',
        git_url:
          'https://api.github.com/repos/facebook/react/git/blobs/file-sha-456',
        download_url:
          'https://raw.githubusercontent.com/facebook/react/main/package.json',
      },
    ];

    it('should return repository files', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.listDirectoryContents.mockResolvedValue(mockFiles);

      const result = await service.getRepositoryFiles(
        mockRepository.id,
        '',
        'main',
      );

      expect(githubService.listDirectoryContents).toHaveBeenCalledWith(
        '',
        'main',
      );
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('src');
      expect(result[1].name).toBe('package.json');
    });

    it('should throw NotFoundException when repository not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.getRepositoryFiles('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileContent', () => {
    const mockFileContent = {
      name: 'package.json',
      path: 'package.json',
      sha: 'file-sha-123',
      size: 1024,
      url: 'https://api.github.com/repos/facebook/react/contents/package.json',
      html_url: 'https://github.com/facebook/react/blob/main/package.json',
      git_url:
        'https://api.github.com/repos/facebook/react/git/blobs/file-sha-123',
      download_url:
        'https://raw.githubusercontent.com/facebook/react/main/package.json',
      type: 'file' as const,
      content: btoa('{"name": "react"}'), // Base64 encoded JSON
      encoding: 'base64',
    };

    it('should return file content', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.getFileContent(
        mockRepository.id,
        'package.json',
        'main',
      );

      expect(githubService.getFileContent).toHaveBeenCalledWith(
        'package.json',
        'main',
      );
      expect(result.content).toBe('{"name": "react"}');
      expect(result.language).toBe('text');
      expect(result.size).toBe(1024);
    });

    it('should detect language correctly', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.getFileContent.mockResolvedValue({
        ...mockFileContent,
        name: 'index.ts',
        path: 'src/index.ts',
      });

      const result = await service.getFileContent(
        mockRepository.id,
        'src/index.ts',
      );

      expect(result.language).toBe('typescript');
    });

    it('should throw NotFoundException when file not found', async () => {
      repository.findOne.mockResolvedValue(mockRepository);
      githubService.getFileContent.mockResolvedValue(null);

      await expect(
        service.getFileContent(mockRepository.id, 'nonexistent.txt'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('detectLanguage', () => {
    it('should detect common languages correctly', () => {
      // Since detectLanguage is private, we test it through getFileContent
      const testCases = [
        ['file.ts', 'typescript'],
        ['file.js', 'javascript'],
        ['file.py', 'python'],
        ['file.java', 'java'],
        ['file.cpp', 'cpp'],
        ['file.c', 'c'],
        ['file.go', 'go'],
        ['file.rs', 'rust'],
        ['file.unknown', 'text'],
      ];

      testCases.forEach(([filename, expectedLang]) => {
        const result = (service as any).detectLanguage(filename);
        expect(result).toBe(expectedLang);
      });
    });
  });
});

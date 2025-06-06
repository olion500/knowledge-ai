import { Test, TestingModule } from '@nestjs/testing';
import { RepositoryController } from './repository.controller';
import { RepositoryService } from './repository.service';
import {
  CreateRepositoryDto,
  UpdateRepositoryDto,
  SyncRepositoryDto,
  RepositoryResponseDto,
} from '../../common/dto/repository.dto';

describe('RepositoryController', () => {
  let controller: RepositoryController;
  let repositoryService: jest.Mocked<RepositoryService>;

  const mockRepositoryResponse: RepositoryResponseDto = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    defaultBranch: 'main',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    language: 'JavaScript',
    lastCommitSha: 'abc123',
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
    htmlUrl: 'https://github.com/facebook/react',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositoryController],
      providers: [
        {
          provide: RepositoryService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findByFullName: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            syncRepository: jest.fn(),
            getRepositoryFiles: jest.fn(),
            getFileContent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RepositoryController>(RepositoryController);
    repositoryService = module.get(RepositoryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRepositoryDto = {
      owner: 'facebook',
      name: 'react',
      description: 'Test description',
      defaultBranch: 'main',
    };

    it('should create a new repository', async () => {
      repositoryService.create.mockResolvedValue(mockRepositoryResponse);

      const result = await controller.create(createDto);

      expect(repositoryService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockRepositoryResponse);
    });

    it('should pass validation errors through', async () => {
      const invalidDto = { owner: '', name: '' } as CreateRepositoryDto;
      
      // This would normally be caught by ValidationPipe before reaching the controller
      // but we test that the controller properly calls the service
      repositoryService.create.mockRejectedValue(new Error('Validation failed'));

      await expect(controller.create(invalidDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return all repositories', async () => {
      const repositories = [mockRepositoryResponse];
      repositoryService.findAll.mockResolvedValue(repositories);

      const result = await controller.findAll();

      expect(repositoryService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(repositories);
    });

    it('should filter by active status', async () => {
      const repositories = [mockRepositoryResponse];
      repositoryService.findAll.mockResolvedValue(repositories);

      const result = await controller.findAll(true);

      expect(repositoryService.findAll).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual(repositories);
    });
  });

  describe('findOne', () => {
    it('should return repository by id', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.findOne.mockResolvedValue(mockRepositoryResponse);

      const result = await controller.findOne(repositoryId);

      expect(repositoryService.findOne).toHaveBeenCalledWith(repositoryId);
      expect(result).toEqual(mockRepositoryResponse);
    });

    it('should handle UUID validation', async () => {
      // This would be handled by ParseUUIDPipe
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.findOne.mockResolvedValue(mockRepositoryResponse);

      await controller.findOne(validUuid);

      expect(repositoryService.findOne).toHaveBeenCalledWith(validUuid);
    });
  });

  describe('findByFullName', () => {
    it('should return repository by owner and name', async () => {
      repositoryService.findByFullName.mockResolvedValue(mockRepositoryResponse);

      const result = await controller.findByFullName('facebook', 'react');

      expect(repositoryService.findByFullName).toHaveBeenCalledWith('facebook', 'react');
      expect(result).toEqual(mockRepositoryResponse);
    });

    it('should handle null result', async () => {
      repositoryService.findByFullName.mockResolvedValue(null);

      const result = await controller.findByFullName('nonexistent', 'repo');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const updateDto: UpdateRepositoryDto = {
      description: 'Updated description',
      active: false,
    };

    it('should update repository', async () => {
      const updatedRepo = { ...mockRepositoryResponse, ...updateDto };
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.update.mockResolvedValue(updatedRepo);

      const result = await controller.update(repositoryId, updateDto);

      expect(repositoryService.update).toHaveBeenCalledWith(repositoryId, updateDto);
      expect(result.description).toBe('Updated description');
      expect(result.active).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete repository', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(repositoryId);

      expect(repositoryService.remove).toHaveBeenCalledWith(repositoryId);
      expect(result).toBeUndefined();
    });
  });

  describe('syncRepository', () => {
    const syncDto: SyncRepositoryDto = {
      force: true,
    };

    it('should sync repository', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      const syncedRepo = { ...mockRepositoryResponse, lastCommitSha: 'xyz789' };
      repositoryService.syncRepository.mockResolvedValue(syncedRepo);

      const result = await controller.syncRepository(repositoryId, syncDto);

      expect(repositoryService.syncRepository).toHaveBeenCalledWith(repositoryId, syncDto);
      expect(result.lastCommitSha).toBe('xyz789');
    });

    it('should sync without dto', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.syncRepository.mockResolvedValue(mockRepositoryResponse);

      const result = await controller.syncRepository(repositoryId);

      expect(repositoryService.syncRepository).toHaveBeenCalledWith(repositoryId, undefined);
      expect(result).toEqual(mockRepositoryResponse);
    });
  });

  describe('getRepositoryFiles', () => {
    const mockFiles = [
      { name: 'src', path: 'src', type: 'dir' as const, size: 0 },
      { name: 'package.json', path: 'package.json', type: 'file' as const, size: 1024 },
    ];

    it('should return repository files with default parameters', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.getRepositoryFiles.mockResolvedValue(mockFiles);

      const result = await controller.getRepositoryFiles(repositoryId);

      expect(repositoryService.getRepositoryFiles).toHaveBeenCalledWith(repositoryId, '', undefined);
      expect(result).toEqual(mockFiles);
    });

    it('should return repository files with custom path and branch', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.getRepositoryFiles.mockResolvedValue(mockFiles);

      const result = await controller.getRepositoryFiles(repositoryId, 'src', 'develop');

      expect(repositoryService.getRepositoryFiles).toHaveBeenCalledWith(repositoryId, 'src', 'develop');
      expect(result).toEqual(mockFiles);
    });
  });

  describe('getFileContent', () => {
    const mockFileContent = {
      content: '{"name": "react", "version": "18.0.0"}',
      language: 'json',
      size: 1024,
    };

    it('should return file content', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      const filePath = 'package.json';
      repositoryService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await controller.getFileContent(repositoryId, filePath);

      expect(repositoryService.getFileContent).toHaveBeenCalledWith(repositoryId, filePath, undefined);
      expect(result).toEqual(mockFileContent);
    });

    it('should return file content with custom branch', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      const filePath = 'src/index.ts';
      const branch = 'develop';
      const tsFileContent = {
        content: 'export default function App() { return <div>Hello</div>; }',
        language: 'typescript',
        size: 2048,
      };
      repositoryService.getFileContent.mockResolvedValue(tsFileContent);

      const result = await controller.getFileContent(repositoryId, filePath, branch);

      expect(repositoryService.getFileContent).toHaveBeenCalledWith(repositoryId, filePath, branch);
      expect(result).toEqual(tsFileContent);
    });

    it('should handle missing filePath parameter', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      
      // This would normally be caught by query validation
      // Testing that the controller properly passes the parameter
      repositoryService.getFileContent.mockRejectedValue(new Error('File path required'));

      await expect(controller.getFileContent(repositoryId, '')).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('should propagate service errors', async () => {
      const repositoryId = 'invalid-id';
      repositoryService.findOne.mockRejectedValue(new Error('Repository not found'));

      await expect(controller.findOne(repositoryId)).rejects.toThrow('Repository not found');
    });

    it('should handle validation errors from service', async () => {
      const createDto: CreateRepositoryDto = {
        owner: 'facebook',
        name: 'react',
      };
      repositoryService.create.mockRejectedValue(new Error('GitHub repository not accessible'));

      await expect(controller.create(createDto)).rejects.toThrow('GitHub repository not accessible');
    });
  });

  describe('parameter validation', () => {
    // These tests verify that the controller properly handles validated parameters
    // The actual validation is done by NestJS pipes

    it('should accept valid UUID for repository operations', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.findOne.mockResolvedValue(mockRepositoryResponse);

      await controller.findOne(validUuid);

      expect(repositoryService.findOne).toHaveBeenCalledWith(validUuid);
    });

    it('should accept valid owner and name parameters', async () => {
      repositoryService.findByFullName.mockResolvedValue(mockRepositoryResponse);

      await controller.findByFullName('facebook', 'react');

      expect(repositoryService.findByFullName).toHaveBeenCalledWith('facebook', 'react');
    });

    it('should handle optional query parameters', async () => {
      const repositoryId = '123e4567-e89b-12d3-a456-426614174000';
      repositoryService.getRepositoryFiles.mockResolvedValue([]);

      // Test with default empty path
      await controller.getRepositoryFiles(repositoryId);
      expect(repositoryService.getRepositoryFiles).toHaveBeenCalledWith(repositoryId, '', undefined);

      // Test with custom path but no branch
      await controller.getRepositoryFiles(repositoryId, 'src');
      expect(repositoryService.getRepositoryFiles).toHaveBeenCalledWith(repositoryId, 'src', undefined);

      // Test with both path and branch
      await controller.getRepositoryFiles(repositoryId, 'src', 'main');
      expect(repositoryService.getRepositoryFiles).toHaveBeenCalledWith(repositoryId, 'src', 'main');
    });
  });
}); 
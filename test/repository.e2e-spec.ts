import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { Repository } from '../src/common/entities/repository.entity';
import { RepositoryModule } from '../src/modules/repository/repository.module';
import { GitHubModule } from '../src/modules/github/github.module';
import { GitHubService } from '../src/modules/github/github.service';

describe('Repository (e2e)', () => {
  let app: INestApplication;
  let repositoryId: string;
  let githubService: GitHubService;

  // Mock GitHub responses
  const mockGitHubRepoInfo = {
    owner: 'testowner',
    name: 'testrepo',
    fullName: 'testowner/testrepo',
    defaultBranch: 'main',
    description: 'Test repository',
    language: 'TypeScript',
    isPrivate: false,
    metadata: {
      stars: 100,
      forks: 50,
      size: 1024,
      topics: ['test', 'typescript'],
    },
  };

  const mockCommitInfo = {
    sha: 'abc123xyz',
    message: 'Test commit',
    author: {
      name: 'Test Author',
      email: 'test@example.com',
      date: '2024-01-01T00:00:00Z',
    },
    url: 'https://github.com/testowner/testrepo/commit/abc123xyz',
  };

  const mockFiles = [
    { name: 'src', path: 'src', type: 'dir', size: 0 },
    { name: 'package.json', path: 'package.json', type: 'file', size: 1024 },
    { name: 'README.md', path: 'README.md', type: 'file', size: 512 },
  ];

  const mockFileContent = {
    name: 'package.json',
    path: 'package.json',
    sha: 'file-sha-123',
    size: 1024,
    url: 'https://api.github.com/repos/testowner/testrepo/contents/package.json',
    html_url: 'https://github.com/testowner/testrepo/blob/main/package.json',
    git_url: 'https://api.github.com/repos/testowner/testrepo/git/blobs/file-sha-123',
    download_url: 'https://raw.githubusercontent.com/testowner/testrepo/main/package.json',
    type: 'file' as const,
    content: Buffer.from('{"name": "testrepo", "version": "1.0.0"}').toString('base64'),
    encoding: 'base64',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test', '.env'],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'sqlite',
            database: ':memory:',
            entities: [Repository],
            synchronize: true,
            dropSchema: true,
            logging: false,
          }),
          inject: [ConfigService],
        }),
        RepositoryModule,
        GitHubModule,
      ],
    })
      .overrideProvider(GitHubService)
      .useValue({
        getRepositoryInfo: jest.fn().mockResolvedValue(mockGitHubRepoInfo),
        getLatestCommit: jest.fn().mockResolvedValue(mockCommitInfo),
        listDirectoryContents: jest.fn().mockResolvedValue(mockFiles),
        getFileContent: jest.fn().mockResolvedValue(mockFileContent),
        getRepositoryContents: jest.fn().mockResolvedValue(mockFiles),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    
    githubService = moduleFixture.get<GitHubService>(GitHubService);
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /repositories', () => {
    it('should create a new repository', async () => {
      const createDto = {
        owner: 'testowner',
        name: 'testrepo',
        description: 'Test repository for E2E testing',
        defaultBranch: 'main',
      };

      const response = await request(app.getHttpServer())
        .post('/repositories')
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        owner: 'testowner',
        name: 'testrepo',
        fullName: 'testowner/testrepo',
        description: 'Test repository for E2E testing',
        defaultBranch: 'main',
        language: 'TypeScript',
        active: true,
        isPrivate: false,
      });

      expect(response.body.id).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.htmlUrl).toBe('https://github.com/testowner/testrepo');

      repositoryId = response.body.id;
    });

    it('should return 409 when repository already exists', async () => {
      const createDto = {
        owner: 'testowner',
        name: 'testrepo',
      };

      await request(app.getHttpServer())
        .post('/repositories')
        .send(createDto)
        .expect(409);
    });

    it('should return 400 for invalid input', async () => {
      const invalidDto = {
        owner: '',
        name: '',
      };

      await request(app.getHttpServer())
        .post('/repositories')
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 when GitHub repository not accessible', async () => {
      (githubService.getRepositoryInfo as jest.Mock).mockRejectedValueOnce(
        new Error('Repository not found')
      );

      const createDto = {
        owner: 'nonexistent',
        name: 'repo',
      };

      await request(app.getHttpServer())
        .post('/repositories')
        .send(createDto)
        .expect(400);

      // Reset the mock
      (githubService.getRepositoryInfo as jest.Mock).mockResolvedValue(mockGitHubRepoInfo);
    });
  });

  describe('GET /repositories', () => {
    it('should return all repositories', async () => {
      const response = await request(app.getHttpServer())
        .get('/repositories')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        owner: 'testowner',
        name: 'testrepo',
        fullName: 'testowner/testrepo',
      });
    });

    it('should filter by active status', async () => {
      const response = await request(app.getHttpServer())
        .get('/repositories?active=true')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((repo: any) => {
        expect(repo.active).toBe(true);
      });
    });
  });

  describe('GET /repositories/:id', () => {
    it('should return repository by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: repositoryId,
        owner: 'testowner',
        name: 'testrepo',
        fullName: 'testowner/testrepo',
      });
    });

    it('should return 404 for non-existent repository', async () => {
      await request(app.getHttpServer())
        .get('/repositories/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/repositories/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /repositories/by-name/:owner/:name', () => {
    it('should return repository by owner and name', async () => {
      const response = await request(app.getHttpServer())
        .get('/repositories/by-name/testowner/testrepo')
        .expect(200);

      expect(response.body).toMatchObject({
        owner: 'testowner',
        name: 'testrepo',
        fullName: 'testowner/testrepo',
      });
    });

    it('should return 404 for non-existent repository', async () => {
      const response = await request(app.getHttpServer())
        .get('/repositories/by-name/nonexistent/repo')
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe('PUT /repositories/:id', () => {
    it('should update repository', async () => {
      const updateDto = {
        description: 'Updated test repository',
        active: false,
      };

      const response = await request(app.getHttpServer())
        .put(`/repositories/${repositoryId}`)
        .send(updateDto)
        .expect(200);

      expect(response.body).toMatchObject({
        id: repositoryId,
        description: 'Updated test repository',
        active: false,
      });
    });

    it('should return 404 for non-existent repository', async () => {
      const updateDto = {
        description: 'Updated description',
      };

      await request(app.getHttpServer())
        .put('/repositories/123e4567-e89b-12d3-a456-426614174999')
        .send(updateDto)
        .expect(404);
    });
  });

  describe('POST /repositories/:id/sync', () => {
    it('should sync repository', async () => {
      const response = await request(app.getHttpServer())
        .post(`/repositories/${repositoryId}/sync`)
        .send({ force: true })
        .expect(200);

      expect(response.body).toMatchObject({
        id: repositoryId,
        lastCommitSha: 'abc123xyz',
      });
      expect(response.body.lastSyncedAt).toBeDefined();
    });

    it('should sync without force flag', async () => {
      await request(app.getHttpServer())
        .post(`/repositories/${repositoryId}/sync`)
        .expect(200);
    });

    it('should return 404 for non-existent repository', async () => {
      await request(app.getHttpServer())
        .post('/repositories/123e4567-e89b-12d3-a456-426614174999/sync')
        .expect(404);
    });
  });

  describe('GET /repositories/:id/files', () => {
    it('should return repository files', async () => {
      const response = await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(3);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'src',
            path: 'src',
            type: 'dir',
          }),
          expect.objectContaining({
            name: 'package.json',
            path: 'package.json',
            type: 'file',
          }),
        ])
      );
    });

    it('should return files with custom path', async () => {
      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files?path=src`)
        .expect(200);

      expect(githubService.listDirectoryContents).toHaveBeenCalledWith('src', undefined);
    });

    it('should return files with custom branch', async () => {
      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files?branch=develop`)
        .expect(200);

      expect(githubService.listDirectoryContents).toHaveBeenCalledWith('', 'develop');
    });

    it('should return 404 for non-existent repository', async () => {
      await request(app.getHttpServer())
        .get('/repositories/123e4567-e89b-12d3-a456-426614174999/files')
        .expect(404);
    });
  });

  describe('GET /repositories/:id/files/content', () => {
    it('should return file content', async () => {
      const response = await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files/content?filePath=package.json`)
        .expect(200);

      expect(response.body).toMatchObject({
        content: '{"name": "testrepo", "version": "1.0.0"}',
        language: 'text',
        size: 1024,
      });
    });

    it('should detect language correctly for TypeScript files', async () => {
      (githubService.getFileContent as jest.Mock).mockResolvedValueOnce({
        ...mockFileContent,
        name: 'index.ts',
        path: 'src/index.ts',
      });

      const response = await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files/content?filePath=src/index.ts`)
        .expect(200);

      expect(response.body.language).toBe('typescript');
    });

    it('should return file content with custom branch', async () => {
      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files/content?filePath=package.json&branch=develop`)
        .expect(200);

      expect(githubService.getFileContent).toHaveBeenCalledWith('package.json', 'develop');
    });

    it('should return 400 when filePath is missing', async () => {
      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files/content`)
        .expect(400);
    });

    it('should return 404 for non-existent file', async () => {
      (githubService.getFileContent as jest.Mock).mockResolvedValueOnce(null);

      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}/files/content?filePath=nonexistent.txt`)
        .expect(404);

      // Reset the mock
      (githubService.getFileContent as jest.Mock).mockResolvedValue(mockFileContent);
    });
  });

  describe('DELETE /repositories/:id', () => {
    it('should delete repository', async () => {
      await request(app.getHttpServer())
        .delete(`/repositories/${repositoryId}`)
        .expect(204);

      // Verify repository is soft deleted
      await request(app.getHttpServer())
        .get(`/repositories/${repositoryId}`)
        .expect(404);
    });

    it('should return 404 for non-existent repository', async () => {
      await request(app.getHttpServer())
        .delete('/repositories/123e4567-e89b-12d3-a456-426614174999')
        .expect(404);
    });
  });

  describe('Integration scenarios', () => {
    let integrationRepoId: string;

    it('should handle complete repository lifecycle', async () => {
      // 1. Create repository
      const createResponse = await request(app.getHttpServer())
        .post('/repositories')
        .send({
          owner: 'integration',
          name: 'test',
          description: 'Integration test repository',
        })
        .expect(201);

      integrationRepoId = createResponse.body.id;
      expect(createResponse.body.active).toBe(true);

      // 2. Get repository
      await request(app.getHttpServer())
        .get(`/repositories/${integrationRepoId}`)
        .expect(200);

      // 3. Update repository
      await request(app.getHttpServer())
        .put(`/repositories/${integrationRepoId}`)
        .send({ description: 'Updated integration test' })
        .expect(200);

      // 4. Sync repository
      await request(app.getHttpServer())
        .post(`/repositories/${integrationRepoId}/sync`)
        .expect(200);

      // 5. Browse files
      await request(app.getHttpServer())
        .get(`/repositories/${integrationRepoId}/files`)
        .expect(200);

      // 6. Get file content
      await request(app.getHttpServer())
        .get(`/repositories/${integrationRepoId}/files/content?filePath=package.json`)
        .expect(200);

      // 7. Deactivate repository
      await request(app.getHttpServer())
        .put(`/repositories/${integrationRepoId}`)
        .send({ active: false })
        .expect(200);

      // 8. Delete repository
      await request(app.getHttpServer())
        .delete(`/repositories/${integrationRepoId}`)
        .expect(204);
    });

    it('should handle error scenarios gracefully', async () => {
      // GitHub service errors
      (githubService.getRepositoryInfo as jest.Mock).mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );

      await request(app.getHttpServer())
        .post('/repositories')
        .send({
          owner: 'error',
          name: 'test',
        })
        .expect(400);

      // Reset mock
      (githubService.getRepositoryInfo as jest.Mock).mockResolvedValue(mockGitHubRepoInfo);
    });
  });
}); 
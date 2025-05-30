import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GitHubService } from './github.service';
import { Octokit } from '@octokit/rest';

// Mock Octokit
jest.mock('@octokit/rest');

describe('GitHubService', () => {
  let service: GitHubService;
  let configService: ConfigService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                GITHUB_TOKEN: 'mock-token',
                GITHUB_OWNER: 'test-owner',
                GITHUB_REPO: 'test-repo',
                DOCS_BASE_PATH: 'docs',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GitHubService>(GitHubService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Get the mocked Octokit instance
    mockOctokit = (Octokit as jest.MockedClass<typeof Octokit>).mock.instances[0] as jest.Mocked<Octokit>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBranch', () => {
    it('should create a new branch', async () => {
      mockOctokit.git = {
        getRef: jest.fn().mockResolvedValue({
          data: {
            object: {
              sha: 'base-sha-123',
            },
          },
        }),
        createRef: jest.fn().mockResolvedValue({}),
      } as any;

      await service.createBranch('feature-branch');

      expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'heads/main',
      });

      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'refs/heads/feature-branch',
        sha: 'base-sha-123',
      });
    });

    it('should throw error when branch creation fails', async () => {
      mockOctokit.git = {
        getRef: jest.fn().mockRejectedValue(new Error('Branch not found')),
      } as any;

      await expect(service.createBranch('feature-branch')).rejects.toThrow('Branch not found');
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const mockFileContent = {
        name: 'test.md',
        path: 'docs/test.md',
        sha: 'file-sha-123',
        size: 100,
        url: 'https://api.github.com/repos/test-owner/test-repo/contents/docs/test.md',
        html_url: 'https://github.com/test-owner/test-repo/blob/main/docs/test.md',
        git_url: 'https://api.github.com/repos/test-owner/test-repo/git/blobs/file-sha-123',
        download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/docs/test.md',
        type: 'file' as const,
        content: 'VGVzdCBjb250ZW50', // Base64 encoded "Test content"
        encoding: 'base64',
      };

      mockOctokit.repos = {
        getContent: jest.fn().mockResolvedValue({
          data: mockFileContent,
        }),
      } as any;

      const result = await service.getFileContent('docs/test.md');

      expect(result).toEqual(mockFileContent);
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'docs/test.md',
        ref: 'main',
      });
    });

    it('should return null when file not found', async () => {
      mockOctokit.repos = {
        getContent: jest.fn().mockRejectedValue({ status: 404 }),
      } as any;

      const result = await service.getFileContent('docs/nonexistent.md');

      expect(result).toBeNull();
    });

    it('should return null when content is directory', async () => {
      mockOctokit.repos = {
        getContent: jest.fn().mockResolvedValue({
          data: [
            { name: 'file1.md', type: 'file' },
            { name: 'file2.md', type: 'file' },
          ],
        }),
      } as any;

      const result = await service.getFileContent('docs');

      expect(result).toBeNull();
    });
  });

  describe('createFile', () => {
    it('should create a new file', async () => {
      mockOctokit.repos = {
        createOrUpdateFileContents: jest.fn().mockResolvedValue({
          data: {
            commit: {
              sha: 'commit-sha-123',
            },
          },
        }),
      } as any;

      const request = {
        message: 'Create test file',
        content: 'Test content',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
      };

      const result = await service.createFile('docs/test.md', request);

      expect(result).toBe('commit-sha-123');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'docs/test.md',
        message: 'Create test file',
        content: Buffer.from('Test content', 'utf-8').toString('base64'),
        branch: 'main',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
        committer: undefined,
      });
    });
  });

  describe('createOrUpdateFile', () => {
    it('should create new file when file does not exist', async () => {
      mockOctokit.repos = {
        getContent: jest.fn().mockRejectedValue({ status: 404 }),
        createOrUpdateFileContents: jest.fn().mockResolvedValue({
          data: {
            commit: {
              sha: 'commit-sha-123',
            },
          },
        }),
      } as any;

      const result = await service.createOrUpdateFile(
        'docs/new-file.md',
        'New content',
        'Create new file',
      );

      expect(result).toBe('commit-sha-123');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'docs/new-file.md',
        message: 'Create new file',
        content: Buffer.from('New content', 'utf-8').toString('base64'),
        branch: 'main',
        author: {
          name: 'Knowledge Sync AI',
          email: 'knowledge-sync-ai@example.com',
        },
        committer: undefined,
      });
    });

    it('should update existing file', async () => {
      const existingFile = {
        name: 'existing.md',
        path: 'docs/existing.md',
        sha: 'existing-sha-123',
        size: 100,
        url: '',
        html_url: '',
        git_url: '',
        download_url: '',
        type: 'file' as const,
        content: 'RXhpc3RpbmcgY29udGVudA==', // Base64 encoded
        encoding: 'base64',
      };

      mockOctokit.repos = {
        getContent: jest.fn().mockResolvedValue({
          data: existingFile,
        }),
        createOrUpdateFileContents: jest.fn().mockResolvedValue({
          data: {
            commit: {
              sha: 'update-commit-sha-123',
            },
          },
        }),
      } as any;

      const result = await service.createOrUpdateFile(
        'docs/existing.md',
        'Updated content',
        'Update existing file',
      );

      expect(result).toBe('update-commit-sha-123');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        path: 'docs/existing.md',
        message: 'Update existing file',
        content: Buffer.from('Updated content', 'utf-8').toString('base64'),
        sha: 'existing-sha-123',
        branch: 'main',
        author: {
          name: 'Knowledge Sync AI',
          email: 'knowledge-sync-ai@example.com',
        },
        committer: undefined,
      });
    });
  });

  describe('createPullRequest', () => {
    it('should create pull request with reviewers and labels', async () => {
      mockOctokit.pulls = {
        create: jest.fn().mockResolvedValue({
          data: {
            number: 123,
            html_url: 'https://github.com/test-owner/test-repo/pull/123',
          },
        }),
        requestReviewers: jest.fn().mockResolvedValue({}),
      } as any;

      mockOctokit.issues = {
        addAssignees: jest.fn().mockResolvedValue({}),
        addLabels: jest.fn().mockResolvedValue({}),
      } as any;

      const pullRequest = {
        title: 'Test PR',
        body: 'Test PR body',
        head: 'feature-branch',
        base: 'main',
        reviewers: ['reviewer1', 'reviewer2'],
        assignees: ['assignee1'],
        labels: ['documentation', 'auto-generated'],
      };

      const result = await service.createPullRequest(pullRequest);

      expect(result).toEqual({
        number: 123,
        url: 'https://github.com/test-owner/test-repo/pull/123',
      });

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test PR',
        body: 'Test PR body',
        head: 'feature-branch',
        base: 'main',
      });

      expect(mockOctokit.pulls.requestReviewers).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        reviewers: ['reviewer1', 'reviewer2'],
      });

      expect(mockOctokit.issues.addAssignees).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        assignees: ['assignee1'],
      });

      expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['documentation', 'auto-generated'],
      });
    });
  });

  describe('generateDocumentPath', () => {
    it('should generate proper document path', async () => {
      // Mock Date to ensure consistent timestamp
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = await service.generateDocumentPath('Product Planning', 'Feature Discussion');

      expect(result).toBe('docs/product-planning/2024-01-15-feature-discussion.md');

      // Restore Date
      jest.restoreAllMocks();
    });

    it('should sanitize topic and title', async () => {
      const mockDate = new Date('2024-01-15T10:30:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const result = await service.generateDocumentPath(
        'Product Planning & Design!',
        'Feature Discussion (Important)',
      );

      expect(result).toBe('docs/product-planning---design-/2024-01-15-feature-discussion--important-.md');

      jest.restoreAllMocks();
    });
  });

  describe('findExistingDocument', () => {
    it('should find most recent document in topic directory', async () => {
      const mockFiles = [
        {
          name: '2024-01-10-old-doc.md',
          path: 'docs/product-planning/2024-01-10-old-doc.md',
          type: 'file' as const,
        },
        {
          name: '2024-01-15-recent-doc.md',
          path: 'docs/product-planning/2024-01-15-recent-doc.md',
          type: 'file' as const,
        },
        {
          name: 'README.md',
          path: 'docs/product-planning/README.md',
          type: 'file' as const,
        },
      ];

      mockOctokit.repos = {
        getContent: jest.fn().mockResolvedValue({
          data: mockFiles,
        }),
      } as any;

      const result = await service.findExistingDocument('product-planning');

      expect(result).toEqual({
        name: '2024-01-15-recent-doc.md',
        path: 'docs/product-planning/2024-01-15-recent-doc.md',
        type: 'file',
      });
    });

    it('should return null when no markdown files found', async () => {
      mockOctokit.repos = {
        getContent: jest.fn().mockResolvedValue({
          data: [
            {
              name: 'README.txt',
              type: 'file',
            },
          ],
        }),
      } as any;

      const result = await service.findExistingDocument('product-planning');

      expect(result).toBeNull();
    });

    it('should return null when directory does not exist', async () => {
      mockOctokit.repos = {
        getContent: jest.fn().mockRejectedValue({ status: 404 }),
      } as any;

      const result = await service.findExistingDocument('nonexistent-topic');

      expect(result).toBeNull();
    });
  });
}); 
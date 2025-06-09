import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { CodeAnalysisService } from './code-analysis.service';
import { CodeStructure } from '../../common/entities/code-structure.entity';
import { CodeChangeLog } from '../../common/entities/code-change-log.entity';
import { RepositoryService } from '../repository/repository.service';
import { GitHubService } from '../github/github.service';
import { TypeScriptParser } from './parsers/typescript-parser';
import { GitHubContent } from '../../common/interfaces/github.interface';

describe('CodeAnalysisService', () => {
  let service: CodeAnalysisService;
  let codeStructureRepository: jest.Mocked<TypeOrmRepository<CodeStructure>>;
  let codeChangeLogRepository: jest.Mocked<TypeOrmRepository<CodeChangeLog>>;
  let repositoryService: jest.Mocked<RepositoryService>;
  let githubService: jest.Mocked<GitHubService>;
  let typescriptParser: jest.Mocked<TypeScriptParser>;

  const mockRepository = {
    id: 'repo-123',
    owner: 'testowner',
    name: 'testrepo',
    lastCommitSha: 'commit123',
    syncConfig: {
      enabled: true,
      branch: 'main',
      syncInterval: 'daily',
    },
  };

  const mockFileContent: GitHubContent = {
    name: 'test.ts',
    path: 'src/test.ts',
    sha: 'file123',
    size: 100,
    url: 'https://api.github.com/repos/test/test/contents/src/test.ts',
    html_url: 'https://github.com/test/test/blob/main/src/test.ts',
    git_url: 'https://api.github.com/repos/test/test/git/blobs/file123',
    download_url:
      'https://raw.githubusercontent.com/test/test/main/src/test.ts',
    type: 'file',
    content: Buffer.from(
      `
      function testFunction(param: string): void {
        console.log(param);
      }
    `,
    ).toString('base64'),
    encoding: 'base64',
  };

  const mockAnalysisResult = {
    filePath: 'src/test.ts',
    language: 'typescript',
    functions: [
      {
        name: 'testFunction',
        signature: 'testFunction(param: string): void',
        fingerprint: 'abc123',
        startLine: 2,
        endLine: 4,
        parameters: [
          {
            name: 'param',
            type: 'string',
            optional: false,
            spread: false,
          },
        ],
        returnType: 'void',
        decorators: [],
        modifiers: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 0,
          linesOfCode: 3,
          maintainabilityIndex: 100,
        },
        dependencies: [],
        isAsync: false,
        isGenerator: false,
        isExported: false,
      },
    ],
    classes: [],
    imports: [],
    exports: [],
    complexity: {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 0,
      linesOfCode: 5,
      maintainabilityIndex: 100,
      totalFunctions: 1,
      totalClasses: 0,
      averageFunctionComplexity: 1,
      averageClassComplexity: 0,
    },
    dependencies: [],
    errors: [],
  };

  beforeEach(async () => {
    const mockCodeStructureRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockCodeChangeLogRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const mockRepositoryService = {
      findOne: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const mockGitHubService = {
      getRepositoryContents: jest.fn(),
      getFileContent: jest.fn(),
      getRepositoryInfo: jest.fn(),
      compareCommits: jest.fn(),
    };

    const mockTypescriptParser = {
      analyzeFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeAnalysisService,
        {
          provide: getRepositoryToken(CodeStructure),
          useValue: mockCodeStructureRepository,
        },
        {
          provide: getRepositoryToken(CodeChangeLog),
          useValue: mockCodeChangeLogRepository,
        },
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
        {
          provide: GitHubService,
          useValue: mockGitHubService,
        },
        {
          provide: TypeScriptParser,
          useValue: mockTypescriptParser,
        },
      ],
    }).compile();

    service = module.get<CodeAnalysisService>(CodeAnalysisService);
    codeStructureRepository = module.get(getRepositoryToken(CodeStructure));
    codeChangeLogRepository = module.get(getRepositoryToken(CodeChangeLog));
    repositoryService = module.get(RepositoryService);
    githubService = module.get(GitHubService);
    typescriptParser = module.get(TypeScriptParser);
  });

  describe('analyzeRepository', () => {
    it('should analyze all files in a repository', async () => {
      const mockFiles = [
        { type: 'file', name: 'test.ts', path: 'src/test.ts' },
        { type: 'file', name: 'test.js', path: 'src/test.js' },
        { type: 'file', name: 'README.md', path: 'README.md' },
      ];

      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getRepositoryContents.mockResolvedValue(mockFiles as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      typescriptParser.analyzeFile.mockResolvedValue(mockAnalysisResult as any);
      codeStructureRepository.find.mockResolvedValue([]);
      codeStructureRepository.save.mockResolvedValue([] as any);
      codeStructureRepository.delete.mockResolvedValue({} as any);

      const result = await service.analyzeRepository('repo-123');

      expect(result.totalFiles).toBe(2); // Only .ts and .js files
      expect(result.analyzedFiles).toBe(2);
      expect(repositoryService.findOne).toHaveBeenCalledWith('repo-123');
      expect(githubService.getRepositoryContents).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        'commit123',
      );
      expect(typescriptParser.analyzeFile).toHaveBeenCalledTimes(2);
    });

    it('should handle analysis errors gracefully', async () => {
      const mockFiles = [
        { type: 'file', name: 'error.ts', path: 'src/error.ts' },
      ];

      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getRepositoryContents.mockResolvedValue(mockFiles as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      typescriptParser.analyzeFile.mockRejectedValue(new Error('Parse error'));
      codeStructureRepository.find.mockResolvedValue([]);

      const result = await service.analyzeRepository('repo-123');

      expect(result.totalFiles).toBe(1);
      expect(result.analyzedFiles).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Parse error');
    });

    it('should throw error when no commit SHA available', async () => {
      const repoWithoutCommit = { ...mockRepository, lastCommitSha: null };
      repositoryService.findOne.mockResolvedValue(repoWithoutCommit as any);

      await expect(service.analyzeRepository('repo-123')).rejects.toThrow(
        'No commit SHA available for analysis',
      );
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a single file', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      typescriptParser.analyzeFile.mockResolvedValue(mockAnalysisResult as any);
      codeStructureRepository.delete.mockResolvedValue({} as any);
      codeStructureRepository.save.mockResolvedValue([] as any);

      const result = await service.analyzeFile(
        'repo-123',
        'src/test.ts',
        'commit123',
      );

      expect(result).toEqual(mockAnalysisResult);
      expect(githubService.getFileContent).toHaveBeenCalledWith(
        'src/test.ts',
        'commit123',
      );
      expect(typescriptParser.analyzeFile).toHaveBeenCalledWith(
        'src/test.ts',
        expect.any(String),
        expect.objectContaining({ language: 'typescript' }),
      );
      expect(codeStructureRepository.save).toHaveBeenCalled();
    });

    it('should handle missing files', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(null);

      await expect(
        service.analyzeFile('repo-123', 'missing.ts', 'commit123'),
      ).rejects.toThrow('File missing.ts not found');
    });

    it('should handle files without content', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue({ content: null } as any);

      await expect(
        service.analyzeFile('repo-123', 'empty.ts', 'commit123'),
      ).rejects.toThrow('File empty.ts not found');
    });

    it('should detect language correctly', async () => {
      const testCases = [
        { filePath: 'test.ts', expectedLanguage: 'typescript' },
        { filePath: 'test.tsx', expectedLanguage: 'typescript' },
        { filePath: 'test.js', expectedLanguage: 'javascript' },
        { filePath: 'test.jsx', expectedLanguage: 'javascript' },
        { filePath: 'test.py', expectedLanguage: 'python' },
      ];

      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      codeStructureRepository.delete.mockResolvedValue({} as any);
      codeStructureRepository.save.mockResolvedValue([] as any);

      for (const testCase of testCases) {
        const mockResult = {
          ...mockAnalysisResult,
          language: testCase.expectedLanguage,
        };

        if (
          testCase.expectedLanguage === 'typescript' ||
          testCase.expectedLanguage === 'javascript'
        ) {
          typescriptParser.analyzeFile.mockResolvedValue(mockResult as any);

          await service.analyzeFile('repo-123', testCase.filePath, 'commit123');

          expect(typescriptParser.analyzeFile).toHaveBeenCalledWith(
            testCase.filePath,
            expect.any(String),
            expect.objectContaining({ language: testCase.expectedLanguage }),
          );
        } else {
          await expect(
            service.analyzeFile('repo-123', testCase.filePath, 'commit123'),
          ).rejects.toThrow(
            `Unsupported language: ${testCase.expectedLanguage}`,
          );
        }
      }
    });
  });

  describe('compareCommits', () => {
    it('should compare code structures between commits', async () => {
      const oldStructures = [
        {
          fingerprint: 'old123',
          functionName: 'oldFunction',
          signature: 'oldFunction(): void',
          startLine: 1,
          endLine: 3,
          filePath: 'test.ts',
          metadata: { cyclomaticComplexity: 1, linesOfCode: 3 },
          astData: { parameters: [] },
        },
      ];

      const newStructures = [
        {
          fingerprint: 'new456',
          functionName: 'newFunction',
          signature: 'newFunction(): void',
          startLine: 1,
          endLine: 3,
          filePath: 'test.ts',
          metadata: { cyclomaticComplexity: 1, linesOfCode: 3 },
          astData: { parameters: [] },
        },
      ];

      codeStructureRepository.find
        .mockResolvedValueOnce(oldStructures as any)
        .mockResolvedValueOnce(newStructures as any);
      codeChangeLogRepository.save.mockResolvedValue([] as any);

      const result = await service.compareCommits(
        'repo-123',
        'oldCommit',
        'newCommit',
      );

      expect(result.added).toHaveLength(1);
      expect(result.deleted).toHaveLength(1);
      expect(result.modified).toHaveLength(0);
      expect(result.moved).toHaveLength(0);
      expect(result.renamed).toHaveLength(0);

      expect(codeStructureRepository.find).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-123', commitSha: 'oldCommit' },
      });
      expect(codeStructureRepository.find).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-123', commitSha: 'newCommit' },
      });
    });

    it('should detect unchanged functions', async () => {
      const sameStructure = {
        fingerprint: 'same123',
        functionName: 'sameFunction',
        signature: 'sameFunction(): void',
        startLine: 1,
        endLine: 3,
        filePath: 'test.ts',
        metadata: { cyclomaticComplexity: 1, linesOfCode: 3 },
        astData: { parameters: [] },
      };

      codeStructureRepository.find
        .mockResolvedValueOnce([sameStructure] as any)
        .mockResolvedValueOnce([sameStructure] as any);
      codeChangeLogRepository.save.mockResolvedValue([] as any);

      const result = await service.compareCommits(
        'repo-123',
        'commit1',
        'commit2',
      );

      expect(result.added).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.moved).toHaveLength(0);
      expect(result.renamed).toHaveLength(0);
    });
  });

  describe('getRepositoryStructure', () => {
    it('should return repository structure summary', async () => {
      const mockStructures = [
        {
          filePath: 'src/service.ts',
          functionName: 'serviceFunction',
          className: null,
          metadata: { cyclomaticComplexity: 2 },
          astData: { parameters: [] },
          fingerprint: 'service123',
          signature: 'serviceFunction(): void',
          startLine: 1,
          endLine: 5,
        },
        {
          filePath: 'src/service.ts',
          functionName: 'method',
          className: 'ServiceClass',
          metadata: { cyclomaticComplexity: 3 },
          astData: { parameters: [] },
          fingerprint: 'method123',
          signature: 'method(): void',
          startLine: 10,
          endLine: 15,
        },
      ];

      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      codeStructureRepository.find.mockResolvedValue(mockStructures as any);

      const result = await service.getRepositoryStructure('repo-123');

      expect(result.files).toHaveLength(1); // Grouped by file path
      expect(result.files[0].filePath).toBe('src/service.ts');
      expect(result.files[0].functions).toHaveLength(1); // Only functions without className
      expect(result.files[0].classes).toHaveLength(1); // Only functions with className

      expect(result.summary.totalFiles).toBe(1);
      expect(result.summary.totalFunctions).toBe(1);
      expect(result.summary.totalClasses).toBe(1);
      expect(result.summary.averageComplexity).toBe(2.5); // (2 + 3) / 2
    });

    it('should use provided commit SHA for structure retrieval', async () => {
      const customCommit = 'custom456';
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      codeStructureRepository.find.mockResolvedValue([]);

      await service.getRepositoryStructure('repo-123', customCommit);

      expect(codeStructureRepository.find).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-123', commitSha: customCommit },
      });
    });
  });

  describe('findFunction', () => {
    it('should find functions by name', async () => {
      const mockStructures = [
        { functionName: 'testFunction', className: null },
        { functionName: 'testFunction', className: 'TestClass' },
      ];

      codeStructureRepository.find.mockResolvedValue(mockStructures as any);

      const result = await service.findFunction('repo-123', 'testFunction');

      expect(result).toEqual(mockStructures);
      expect(codeStructureRepository.find).toHaveBeenCalledWith({
        where: {
          repositoryId: 'repo-123',
          functionName: 'testFunction',
          active: true,
        },
      });
    });

    it('should find functions by name and class', async () => {
      const mockStructures = [
        { functionName: 'testMethod', className: 'TestClass' },
      ];

      codeStructureRepository.find.mockResolvedValue(mockStructures as any);

      const result = await service.findFunction(
        'repo-123',
        'testMethod',
        'TestClass',
      );

      expect(result).toEqual(mockStructures);
      expect(codeStructureRepository.find).toHaveBeenCalledWith({
        where: {
          repositoryId: 'repo-123',
          functionName: 'testMethod',
          className: 'TestClass',
          active: true,
        },
      });
    });
  });

  describe('getFunctionHistory', () => {
    it('should return function change history', async () => {
      const mockChangeLogs = [
        {
          changeType: 'modified',
          createdAt: new Date('2024-01-02'),
          changeDetails: { linesAdded: 5 },
        },
        {
          changeType: 'added',
          createdAt: new Date('2024-01-01'),
          changeDetails: { linesAdded: 10 },
        },
      ];

      codeChangeLogRepository.find.mockResolvedValue(mockChangeLogs as any);

      const result = await service.getFunctionHistory(
        'repo-123',
        'function123',
      );

      expect(result).toEqual(mockChangeLogs);
      expect(codeChangeLogRepository.find).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-123' },
        relations: ['codeStructure'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle repository not found', async () => {
      repositoryService.findOne.mockRejectedValue(
        new Error('Repository not found'),
      );

      await expect(service.analyzeRepository('invalid-repo')).rejects.toThrow();
    });

    it('should handle GitHub API errors', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getRepositoryContents.mockRejectedValue(
        new Error('GitHub API error'),
      );

      await expect(service.analyzeRepository('repo-123')).rejects.toThrow();
    });

    it('should handle parser errors', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      typescriptParser.analyzeFile.mockRejectedValue(new Error('Parser error'));

      await expect(
        service.analyzeFile('repo-123', 'test.ts', 'commit123'),
      ).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);
      typescriptParser.analyzeFile.mockResolvedValue(mockAnalysisResult as any);
      codeStructureRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.analyzeFile('repo-123', 'test.ts', 'commit123'),
      ).rejects.toThrow();
    });

    it('should handle unsupported languages', async () => {
      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent);

      await expect(
        service.analyzeFile('repo-123', 'test.py', 'commit123'),
      ).rejects.toThrow('Unsupported language: python');
    });
  });

  describe('Language Detection', () => {
    it('should detect file languages correctly', async () => {
      const testCases = [
        { extension: 'ts', expected: 'typescript' },
        { extension: 'tsx', expected: 'typescript' },
        { extension: 'js', expected: 'javascript' },
        { extension: 'jsx', expected: 'javascript' },
        { extension: 'py', expected: 'python' },
        { extension: 'java', expected: 'java' },
        { extension: 'cpp', expected: 'cpp' },
        { extension: 'c', expected: 'c' },
        { extension: 'go', expected: 'go' },
        { extension: 'rs', expected: 'rust' },
        { extension: 'unknown', expected: 'unknown' },
      ];

      for (const testCase of testCases) {
        const filePath = `test.${testCase.extension}`;

        // Call the private method through analyzeFile if it's TypeScript/JavaScript
        if (
          testCase.expected === 'typescript' ||
          testCase.expected === 'javascript'
        ) {
          repositoryService.findOne.mockResolvedValue(mockRepository as any);
          githubService.getFileContent.mockResolvedValue(mockFileContent);
          typescriptParser.analyzeFile.mockResolvedValue(
            mockAnalysisResult as any,
          );
          codeStructureRepository.delete.mockResolvedValue({} as any);
          codeStructureRepository.save.mockResolvedValue([] as any);

          await service.analyzeFile('repo-123', filePath, 'commit123');
        }
      }
    });
  });

  describe('File Filtering', () => {
    it('should filter analyzable files correctly', async () => {
      const mockFiles = [
        { type: 'file', name: 'test.ts', path: 'src/test.ts' },
        { type: 'file', name: 'test.js', path: 'src/test.js' },
        { type: 'file', name: 'test.py', path: 'src/test.py' },
        { type: 'file', name: 'README.md', path: 'README.md' },
        { type: 'file', name: 'package.json', path: 'package.json' },
        { type: 'directory', name: 'node_modules', path: 'node_modules' },
      ];

      repositoryService.findOne.mockResolvedValue(mockRepository as any);
      githubService.getRepositoryContents.mockResolvedValue(mockFiles as any);
      githubService.getFileContent.mockResolvedValue(mockFileContent as any);
      typescriptParser.analyzeFile.mockResolvedValue(mockAnalysisResult as any);
      codeStructureRepository.find.mockResolvedValue([]);
      codeStructureRepository.save.mockResolvedValue([] as any);
      codeStructureRepository.delete.mockResolvedValue({} as any);

      const result = await service.analyzeRepository('repo-123');

      // Should only analyze .ts, .js, .py files (3 files), but parser only handles ts/js
      expect(result.totalFiles).toBe(3);
      expect(result.analyzedFiles).toBe(2); // Only ts and js files succeed
      expect(result.errors).toHaveLength(1); // py file fails with unsupported language
    });
  });
});

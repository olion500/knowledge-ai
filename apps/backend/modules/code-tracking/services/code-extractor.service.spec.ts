import { Test, TestingModule } from '@nestjs/testing';
import { CodeExtractorService } from './code-extractor.service';
import { GitHubService } from '../../github/github.service';

describe('CodeExtractorService', () => {
  let service: CodeExtractorService;
  let gitHubService: GitHubService;

  const mockGitHubService = {
    getFileContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeExtractorService,
        {
          provide: GitHubService,
          useValue: mockGitHubService,
        },
      ],
    }).compile();

    service = module.get<CodeExtractorService>(CodeExtractorService);
    gitHubService = module.get<GitHubService>(GitHubService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractLineBasedCode', () => {
    it('should extract single line of code', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `line 1
line 2
line 3
line 4
line 5`,
        ).toString('base64'),
        sha: 'abc123',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.extractLineBasedCode(
        'owner',
        'repo',
        'src/file.ts',
        3,
      );

      expect(result).toEqual({
        content: 'line 3',
        lineNumbers: [3],
        totalLines: 5,
        sha: 'abc123',
      });
    });

    it('should extract range of lines', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `function test() {
  console.log("start");
  let a = 1;
  let b = 2;
  return a + b;
}`,
        ).toString('base64'),
        sha: 'def456',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.extractLineBasedCode(
        'owner',
        'repo',
        'src/file.ts',
        2,
        4,
      );

      expect(result).toEqual({
        content: '  console.log("start");\n  let a = 1;\n  let b = 2;',
        lineNumbers: [2, 3, 4],
        totalLines: 6,
        sha: 'def456',
      });
    });

    it('should handle line numbers out of range', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `line 1
line 2
line 3`,
        ).toString('base64'),
        sha: 'ghi789',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      await expect(
        service.extractLineBasedCode('owner', 'repo', 'src/file.ts', 5),
      ).rejects.toThrow('Line number 5 is out of range (file has 3 lines)');
    });

    it('should throw error when file not found', async () => {
      mockGitHubService.getFileContent.mockResolvedValue(null);

      await expect(
        service.extractLineBasedCode('owner', 'repo', 'nonexistent.ts', 1),
      ).rejects.toThrow('File not found: nonexistent.ts');
    });
  });

  describe('extractFunctionBasedCode', () => {
    it('should extract function by name', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `class TestClass {
  constructor() {}

  public testMethod() {
    console.log("test");
    return true;
  }

  private anotherMethod() {
    return false;
  }
}`,
        ).toString('base64'),
        sha: 'jkl012',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.extractFunctionBasedCode(
        'owner',
        'repo',
        'src/file.ts',
        'testMethod',
      );

      expect(result).toEqual({
        content:
          '  public testMethod() {\n    console.log("test");\n    return true;\n  }',
        functionName: 'testMethod',
        startLine: 4,
        endLine: 7,
        sha: 'jkl012',
      });
    });

    it('should extract class method with class name', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `class TestClass {
  static staticMethod() {
    return "static";
  }
}

class AnotherClass {
  staticMethod() {
    return "instance";
  }
}`,
        ).toString('base64'),
        sha: 'mno345',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.extractFunctionBasedCode(
        'owner',
        'repo',
        'src/file.ts',
        'AnotherClass.staticMethod',
      );

      expect(result).toEqual({
        content: '  staticMethod() {\n    return "instance";\n  }',
        functionName: 'AnotherClass.staticMethod',
        startLine: 8,
        endLine: 10,
        sha: 'mno345',
      });
    });

    it('should extract standalone function', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `export function calculateSum(a: number, b: number): number {
  return a + b;
}

function helperFunction() {
  console.log("helper");
}`,
        ).toString('base64'),
        sha: 'pqr678',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      const result = await service.extractFunctionBasedCode(
        'owner',
        'repo',
        'src/file.ts',
        'calculateSum',
      );

      expect(result).toEqual({
        content:
          'export function calculateSum(a: number, b: number): number {\n  return a + b;\n}',
        functionName: 'calculateSum',
        startLine: 1,
        endLine: 3,
        sha: 'pqr678',
      });
    });

    it('should throw error when function not found', async () => {
      const mockFileContent = {
        content: Buffer.from(
          `function existingFunction() {
  return true;
}`,
        ).toString('base64'),
        sha: 'stu901',
      };

      mockGitHubService.getFileContent.mockResolvedValue(mockFileContent);

      await expect(
        service.extractFunctionBasedCode(
          'owner',
          'repo',
          'src/file.ts',
          'nonExistentFunction',
        ),
      ).rejects.toThrow(
        'Function "nonExistentFunction" not found in file src/file.ts',
      );
    });
  });

  describe('getFileLanguage', () => {
    it('should detect TypeScript files', () => {
      expect(service.getFileLanguage('src/file.ts')).toBe('typescript');
      expect(service.getFileLanguage('src/file.tsx')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      expect(service.getFileLanguage('src/file.js')).toBe('javascript');
      expect(service.getFileLanguage('src/file.jsx')).toBe('javascript');
    });

    it('should detect Python files', () => {
      expect(service.getFileLanguage('src/file.py')).toBe('python');
    });

    it('should return text for unknown extensions', () => {
      expect(service.getFileLanguage('src/file.unknown')).toBe('text');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { CodeParserService } from './code-parser.service';

describe('CodeParserService', () => {
  let service: CodeParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CodeParserService],
    }).compile();

    service = module.get<CodeParserService>(CodeParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseCodeLinks', () => {
    it('should parse line-based GitHub links', () => {
      const content = `
# 문서 제목

이것은 예시 코드입니다:
[코드 예시](github://owner/repo/src/utils/helper.ts:15)

다른 내용...
[다른 코드](github://owner/repo/src/services/auth.service.ts:25-30)
      `;

      const links = service.parseCodeLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0]).toEqual({
        type: 'line',
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/utils/helper.ts',
        startLine: 15,
        originalText: '[코드 예시](github://owner/repo/src/utils/helper.ts:15)',
        context: '이것은 예시 코드입니다:',
      });

      expect(links[1]).toEqual({
        type: 'range',
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/services/auth.service.ts',
        startLine: 25,
        endLine: 30,
        originalText:
          '[다른 코드](github://owner/repo/src/services/auth.service.ts:25-30)',
        context: '다른 내용...',
      });
    });

    it('should parse function-based GitHub links', () => {
      const content = `
# API 문서

이 함수는 인증을 처리합니다:
[authenticateUser 함수](github://owner/repo/src/auth/auth.service.ts#authenticateUser)

클래스 메서드도 지원합니다:
[UserService.createUser](github://owner/repo/src/user/user.service.ts#UserService.createUser)
      `;

      const links = service.parseCodeLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0]).toEqual({
        type: 'function',
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/auth/auth.service.ts',
        functionName: 'authenticateUser',
        originalText:
          '[authenticateUser 함수](github://owner/repo/src/auth/auth.service.ts#authenticateUser)',
        context: '이 함수는 인증을 처리합니다:',
      });

      expect(links[1]).toEqual({
        type: 'function',
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/user/user.service.ts',
        functionName: 'UserService.createUser',
        originalText:
          '[UserService.createUser](github://owner/repo/src/user/user.service.ts#UserService.createUser)',
        context: '클래스 메서드도 지원합니다:',
      });
    });

    it('should return empty array for content without GitHub links', () => {
      const content = `
# 일반 문서

이것은 일반적인 마크다운 문서입니다.
[일반 링크](https://example.com)
[파일 링크](./local-file.md)
      `;

      const links = service.parseCodeLinks(content);
      expect(links).toHaveLength(0);
    });

    it('should handle mixed content with various link types', () => {
      const content = `
# 혼합 문서

일반 링크: [사이트](https://example.com)
코드 링크: [helper 함수](github://myorg/myrepo/src/helper.ts:42)
또 다른 일반 링크: [문서](./doc.md)
함수 링크: [auth](github://myorg/myrepo/auth.ts#authenticate)
      `;

      const links = service.parseCodeLinks(content);
      expect(links).toHaveLength(2);
    });
  });

  describe('extractRepoInfo', () => {
    it('should extract repository info from GitHub URL', () => {
      const url = 'github://owner/repo/src/file.ts:10';
      const info = service.extractRepoInfo(url);

      expect(info).toEqual({
        owner: 'owner',
        repo: 'repo',
        filePath: 'src/file.ts',
      });
    });

    it('should handle complex file paths', () => {
      const url =
        'github://myorg/myproject/src/modules/auth/services/auth.service.ts#authenticate';
      const info = service.extractRepoInfo(url);

      expect(info).toEqual({
        owner: 'myorg',
        repo: 'myproject',
        filePath: 'src/modules/auth/services/auth.service.ts',
      });
    });

    it('should throw error for invalid GitHub URL', () => {
      const invalidUrl = 'https://github.com/owner/repo';

      expect(() => service.extractRepoInfo(invalidUrl)).toThrow(
        'Invalid GitHub URL format',
      );
    });
  });

  describe('validateCodeReference', () => {
    it('should validate line-based code reference', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'line' as const,
        startLine: 10,
      };

      expect(service.validateCodeReference(ref)).toBe(true);
    });

    it('should validate range-based code reference', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'range' as const,
        startLine: 10,
        endLine: 20,
      };

      expect(service.validateCodeReference(ref)).toBe(true);
    });

    it('should validate function-based code reference', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'function' as const,
        functionName: 'testFunction',
      };

      expect(service.validateCodeReference(ref)).toBe(true);
    });

    it('should reject invalid line reference (missing startLine)', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'line' as const,
      };

      expect(service.validateCodeReference(ref)).toBe(false);
    });

    it('should reject invalid range reference (endLine < startLine)', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'range' as const,
        startLine: 20,
        endLine: 10,
      };

      expect(service.validateCodeReference(ref)).toBe(false);
    });

    it('should reject invalid function reference (missing functionName)', () => {
      const ref = {
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        filePath: 'src/file.ts',
        referenceType: 'function' as const,
      };

      expect(service.validateCodeReference(ref)).toBe(false);
    });
  });
});

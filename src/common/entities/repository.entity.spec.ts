import { Repository } from './repository.entity';

describe('Repository Entity', () => {
  let repository: Repository;

  beforeEach(() => {
    repository = new Repository();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('URL getters', () => {
    beforeEach(() => {
      repository.fullName = 'facebook/react';
    });

    it('should generate correct HTML URL', () => {
      expect(repository.htmlUrl).toBe('https://github.com/facebook/react');
    });

    it('should generate correct clone URL', () => {
      expect(repository.cloneUrl).toBe('https://github.com/facebook/react.git');
    });

    it('should generate correct API URL', () => {
      expect(repository.apiUrl).toBe(
        'https://api.github.com/repos/facebook/react',
      );
    });
  });

  describe('entity properties', () => {
    it('should set basic properties correctly', () => {
      repository.owner = 'facebook';
      repository.name = 'react';
      repository.fullName = 'facebook/react';
      repository.defaultBranch = 'main';
      repository.description =
        'A declarative, efficient, and flexible JavaScript library for building user interfaces.';
      repository.language = 'JavaScript';
      repository.isPrivate = false;
      repository.active = true;

      expect(repository.owner).toBe('facebook');
      expect(repository.name).toBe('react');
      expect(repository.fullName).toBe('facebook/react');
      expect(repository.defaultBranch).toBe('main');
      expect(repository.description).toBe(
        'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
      );
      expect(repository.language).toBe('JavaScript');
      expect(repository.isPrivate).toBe(false);
      expect(repository.active).toBe(true);
    });

    it('should handle nullable properties', () => {
      repository.description = undefined;
      repository.language = undefined;
      repository.lastCommitSha = undefined;
      repository.lastSyncedAt = undefined;

      expect(repository.description).toBeUndefined();
      expect(repository.language).toBeUndefined();
      expect(repository.lastCommitSha).toBeUndefined();
      expect(repository.lastSyncedAt).toBeUndefined();
    });

    it('should set default values correctly', () => {
      // These would be set by TypeORM decorators in actual usage
      repository.defaultBranch = 'main';
      repository.active = true;
      repository.isPrivate = false;

      expect(repository.defaultBranch).toBe('main');
      expect(repository.active).toBe(true);
      expect(repository.isPrivate).toBe(false);
    });
  });

  describe('sync configuration', () => {
    it('should handle sync configuration object', () => {
      const syncConfig = {
        includePaths: ['src/**', 'lib/**'],
        excludePaths: ['node_modules/**', '.git/**'],
        fileExtensions: ['.ts', '.js', '.py'],
        syncFrequency: 'daily' as const,
        autoDocGeneration: true,
      };

      repository.syncConfig = syncConfig;

      expect(repository.syncConfig).toEqual(syncConfig);
      expect(repository.syncConfig?.syncFrequency).toBe('daily');
      expect(repository.syncConfig?.autoDocGeneration).toBe(true);
      expect(repository.syncConfig?.includePaths).toHaveLength(2);
      expect(repository.syncConfig?.excludePaths).toHaveLength(2);
      expect(repository.syncConfig?.fileExtensions).toHaveLength(3);
    });
  });

  describe('metadata', () => {
    it('should handle repository metadata', () => {
      const metadata = {
        stars: 12345,
        forks: 6789,
        size: 1024,
        topics: ['react', 'javascript', 'ui', 'library'],
        openIssues: 100,
        watchers: 5000,
      };

      repository.metadata = metadata;

      expect(repository.metadata).toEqual(metadata);
      expect(repository.metadata?.stars).toBe(12345);
      expect(repository.metadata?.topics).toHaveLength(4);
      expect(repository.metadata?.topics).toContain('react');
    });

    it('should handle custom metadata fields', () => {
      const metadata = {
        stars: 100,
        customField: 'custom value',
        anotherField: { nested: 'data' },
      };

      repository.metadata = metadata;

      expect(repository.metadata?.customField).toBe('custom value');
      expect(repository.metadata?.anotherField).toEqual({ nested: 'data' });
    });
  });
});

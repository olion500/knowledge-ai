import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentService } from './document.service';
import { SlackService } from '../slack/slack.service';
import { LLMService } from '../llm/llm.service';
import { GitHubService } from '../github/github.service';
import { SlackMessage } from '../../common/interfaces/slack.interface';
import { JiraIssue } from '../../common/interfaces/jira.interface';

describe('DocumentService', () => {
  let service: DocumentService;
  let slackService: jest.Mocked<SlackService>;
  let llmService: jest.Mocked<LLMService>;
  let githubService: jest.Mocked<GitHubService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config = {
                DEFAULT_REVIEWERS: 'reviewer1,reviewer2',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: SlackService,
          useValue: {
            getChannelHistory: jest.fn(),
            getMessagesWithReaction: jest.fn(),
            getMessagesWithKeywords: jest.fn(),
          },
        },
        {
          provide: LLMService,
          useValue: {
            summarizeContent: jest.fn(),
            classifyContent: jest.fn(),
            generateDocument: jest.fn(),
          },
        },
        {
          provide: GitHubService,
          useValue: {
            findExistingDocument: jest.fn(),
            getFileContent: jest.fn(),
            createBranch: jest.fn(),
            generateDocumentPath: jest.fn(),
            createOrUpdateFile: jest.fn(),
            createPullRequest: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
    configService = module.get(ConfigService);
    slackService = module.get(SlackService);
    llmService = module.get(LLMService);
    githubService = module.get(GitHubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processSlackMessages', () => {
    it('should process slack messages and create documentation', async () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'We need to decide on the new feature implementation',
          timestamp: '1234567890.123456',
          reactions: [
            {
              name: 'memo',
              count: 1,
              users: ['U1234567890'],
            },
          ],
        },
        {
          id: '1234567890.123457',
          channel: 'C1234567890',
          user: 'U0987654321',
          text: 'I agree, lets go with option A',
          timestamp: '1234567890.123457',
          threadTs: '1234567890.123456',
        },
      ];

      const mockSummary = {
        summary: 'Discussion about new feature implementation',
        keyPoints: ['Feature implementation decision needed'],
        decisions: ['Go with option A'],
        actionItems: ['Implement option A'],
        participants: ['U1234567890', 'U0987654321'],
        tags: ['feature', 'decision'],
      };

      const mockClassification = {
        topic: 'product-planning',
        confidence: 0.95,
        reasoning: 'Discussion about product features',
        suggestedTags: ['product', 'planning'],
      };

      const mockDocument = {
        title: 'Feature Implementation Decision',
        content: '# Feature Implementation Decision\n\nContent...',
        metadata: {
          topic: 'product-planning',
          tags: ['feature', 'decision'],
          lastUpdated: '2024-01-01T00:00:00.000Z',
          sources: ['slack'],
          participants: ['U1234567890', 'U0987654321'],
        },
        isUpdate: false,
      };

      llmService.summarizeContent.mockResolvedValue(mockSummary);
      llmService.classifyContent.mockResolvedValue(mockClassification);
      llmService.generateDocument.mockResolvedValue(mockDocument);
      githubService.findExistingDocument.mockResolvedValue(null);
      githubService.generateDocumentPath.mockResolvedValue('docs/product-planning/2024-01-01-feature-implementation-decision.md');
      githubService.createBranch.mockResolvedValue();
      githubService.createOrUpdateFile.mockResolvedValue('commit-sha-123');
      githubService.createPullRequest.mockResolvedValue({
        number: 123,
        url: 'https://github.com/test/repo/pull/123',
      });

      await service.processSlackMessages(mockMessages);

      expect(llmService.summarizeContent).toHaveBeenCalledWith({
        content: '[U1234567890]: We need to decide on the new feature implementation\n[U0987654321]: I agree, lets go with option A',
        contentType: 'slack',
        context: {
          channel: 'C1234567890',
          participants: ['U1234567890', 'U0987654321'],
          messageCount: 2,
        },
      });

      expect(llmService.classifyContent).toHaveBeenCalledWith({
        content: '[U1234567890]: We need to decide on the new feature implementation\n[U0987654321]: I agree, lets go with option A',
        availableTopics: expect.arrayContaining(['product-planning', 'technical-architecture']),
        context: {
          source: 'slack',
          metadata: {
            channel: 'C1234567890',
            participants: ['U1234567890', 'U0987654321'],
            messageCount: 2,
          },
        },
      });

      expect(githubService.createPullRequest).toHaveBeenCalledWith({
        title: '📄 New: Feature Implementation Decision',
        body: expect.stringContaining('Discussion about new feature implementation'),
        head: expect.stringContaining('knowledge-sync/product-planning-'),
        base: 'main',
        reviewers: ['reviewer1', 'reviewer2'],
        labels: ['documentation', 'topic:product-planning', 'source:slack'],
      });
    });

    it('should group messages by thread', () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1234567890.123456',
          channel: 'C1234567890',
          user: 'U1234567890',
          text: 'Main message',
          timestamp: '1234567890.123456',
        },
        {
          id: '1234567890.123457',
          channel: 'C1234567890',
          user: 'U0987654321',
          text: 'Reply 1',
          timestamp: '1234567890.123457',
          threadTs: '1234567890.123456',
        },
        {
          id: '1234567890.123458',
          channel: 'C1234567890',
          user: 'U1111111111',
          text: 'Another main message',
          timestamp: '1234567890.123458',
        },
      ];

      const conversations = (service as any).groupSlackMessages(mockMessages);

      expect(conversations).toHaveLength(2);
      expect(conversations[0]).toHaveLength(2); // Main message + reply
      expect(conversations[1]).toHaveLength(1); // Another main message
    });
  });

  describe('processJiraIssue', () => {
    it('should process jira issue and create documentation', async () => {
      const mockIssue: JiraIssue = {
        id: 'ISSUE-123',
        key: 'PROJ-123',
        summary: 'Bug in user authentication',
        description: 'Users cannot login with their credentials',
        issueType: 'Bug',
        status: 'Open',
        priority: 'High',
        reporter: {
          accountId: 'user1',
          displayName: 'John Doe',
          avatarUrls: {
            '48x48': '',
            '24x24': '',
            '16x16': '',
            '32x32': '',
          },
        },
        project: {
          id: 'PROJ',
          key: 'PROJ',
          name: 'Test Project',
          projectTypeKey: 'software',
        },
        components: [],
        labels: ['authentication', 'bug'],
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            author: {
              accountId: 'user2',
              displayName: 'Jane Smith',
              avatarUrls: {
                '48x48': '',
                '24x24': '',
                '16x16': '',
                '32x32': '',
              },
            },
            body: 'I can reproduce this issue',
            created: '2024-01-01T01:00:00.000Z',
            updated: '2024-01-01T01:00:00.000Z',
          },
        ],
      };

      const mockSummary = {
        summary: 'Bug report about user authentication issues',
        keyPoints: ['Users cannot login'],
        decisions: [],
        actionItems: ['Fix authentication bug'],
        participants: ['John Doe', 'Jane Smith'],
        tags: ['bug', 'authentication'],
      };

      const mockClassification = {
        topic: 'bug-reports',
        confidence: 0.98,
        reasoning: 'This is clearly a bug report',
        suggestedTags: ['bug', 'authentication'],
      };

      const mockDocument = {
        title: 'Authentication Bug Report',
        content: '# Authentication Bug Report\n\nContent...',
        metadata: {
          topic: 'bug-reports',
          tags: ['bug', 'authentication'],
          lastUpdated: '2024-01-01T00:00:00.000Z',
          sources: ['jira'],
          participants: ['John Doe', 'Jane Smith'],
        },
        isUpdate: false,
      };

      llmService.summarizeContent.mockResolvedValue(mockSummary);
      llmService.classifyContent.mockResolvedValue(mockClassification);
      llmService.generateDocument.mockResolvedValue(mockDocument);
      githubService.findExistingDocument.mockResolvedValue(null);
      githubService.generateDocumentPath.mockResolvedValue('docs/bug-reports/2024-01-01-authentication-bug-report.md');
      githubService.createBranch.mockResolvedValue();
      githubService.createOrUpdateFile.mockResolvedValue('commit-sha-123');
      githubService.createPullRequest.mockResolvedValue({
        number: 124,
        url: 'https://github.com/test/repo/pull/124',
      });

      await service.processJiraIssue(mockIssue);

      expect(llmService.summarizeContent).toHaveBeenCalledWith({
        content: expect.stringContaining('Bug in user authentication'),
        contentType: 'jira',
        context: {
          project: 'PROJ',
          participants: ['John Doe', 'Jane Smith'],
          issueType: 'Bug',
          priority: 'High',
          status: 'Open',
          components: [],
          labels: ['authentication', 'bug'],
        },
      });
    });
  });

  describe('prepareContentForLLM', () => {
    it('should format slack messages correctly', () => {
      const mockMessages: SlackMessage[] = [
        {
          id: '1',
          channel: 'C1',
          user: 'U1',
          text: 'Hello',
          timestamp: '1',
        },
        {
          id: '2',
          channel: 'C1',
          user: 'U2',
          text: 'World',
          timestamp: '2',
        },
      ];

      const result = (service as any).prepareContentForLLM(mockMessages, 'slack');

      expect(result).toBe('[U1]: Hello\n[U2]: World');
    });

    it('should format jira issue correctly', () => {
      const mockIssue: JiraIssue = {
        id: 'ISSUE-123',
        key: 'PROJ-123',
        summary: 'Test Issue',
        description: 'Test Description',
        issueType: 'Bug',
        status: 'Open',
        priority: 'High',
        reporter: {
          accountId: 'user1',
          displayName: 'John Doe',
          avatarUrls: {
            '48x48': '',
            '24x24': '',
            '16x16': '',
            '32x32': '',
          },
        },
        project: {
          id: 'PROJ',
          key: 'PROJ',
          name: 'Test Project',
          projectTypeKey: 'software',
        },
        components: [],
        labels: [],
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T00:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            author: {
              accountId: 'user2',
              displayName: 'Jane Smith',
              avatarUrls: {
                '48x48': '',
                '24x24': '',
                '16x16': '',
                '32x32': '',
              },
            },
            body: 'Test comment',
            created: '2024-01-01T01:00:00.000Z',
            updated: '2024-01-01T01:00:00.000Z',
          },
        ],
      };

      const result = (service as any).prepareContentForLLM([mockIssue], 'jira');

      expect(result).toContain('Title: Test Issue');
      expect(result).toContain('Description: Test Description');
      expect(result).toContain('[Jane Smith]: Test comment');
    });
  });

  describe('generatePRDescription', () => {
    it('should generate proper PR description', () => {
      const mockDocument = {
        title: 'Test Document',
        isUpdate: false,
      };

      const mockSummary = {
        summary: 'Test summary',
        keyPoints: ['Point 1', 'Point 2'],
        decisions: ['Decision 1'],
        actionItems: ['Action 1'],
        participants: ['user1', 'user2'],
        tags: ['tag1', 'tag2'],
      };

      const mockClassification = {
        topic: 'product-planning',
        confidence: 0.95,
        reasoning: 'Test reasoning',
        suggestedTags: ['product'],
      };

      const result = (service as any).generatePRDescription(
        mockDocument,
        mockSummary,
        mockClassification,
        'slack',
      );

      expect(result).toContain('Test summary');
      expect(result).toContain('product-planning');
      expect(result).toContain('95.0%');
      expect(result).toContain('SLACK');
      expect(result).toContain('user1, user2');
      expect(result).toContain('Documentation Update');
      expect(result).not.toContain('Changes');
    });

    it('should include changes summary for updates', () => {
      const mockDocument = {
        title: 'Test Document',
        isUpdate: true,
        changesSummary: 'Added new information',
      };

      const mockSummary = {
        summary: 'Test summary',
        keyPoints: [],
        decisions: [],
        actionItems: [],
        participants: [],
        tags: [],
      };

      const mockClassification = {
        topic: 'product-planning',
        confidence: 0.95,
        reasoning: 'Test reasoning',
        suggestedTags: [],
      };

      const result = (service as any).generatePRDescription(
        mockDocument,
        mockSummary,
        mockClassification,
        'slack',
      );

      expect(result).toContain('Changes');
      expect(result).toContain('Added new information');
    });
  });
}); 
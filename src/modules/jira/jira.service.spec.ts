import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JiraService } from './jira.service';
import { DocumentService } from '../document/document.service';
import { JiraIssue, JiraWebhookEvent } from '../../common/interfaces/jira.interface';

// Mock axios for HTTP requests
jest.mock('axios');

describe('JiraService', () => {
  let service: JiraService;
  let configService: ConfigService;
  let documentService: jest.Mocked<DocumentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JiraService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JIRA_HOST: 'https://test.atlassian.net',
                JIRA_USERNAME: 'test@example.com',
                JIRA_API_TOKEN: 'test-token',
              };
              return config[key];
            }),
          },
        },
        {
          provide: DocumentService,
          useValue: {
            processJiraIssue: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JiraService>(JiraService);
    configService = module.get<ConfigService>(ConfigService);
    documentService = module.get(DocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhookEvent', () => {
    it('should process issue created event', async () => {
      const mockEvent: JiraWebhookEvent = {
        timestamp: Date.now(),
        webhookEvent: 'jira:issue_created',
        user: {
          accountId: 'user1',
          displayName: 'John Doe',
          avatarUrls: {
            '48x48': '',
            '24x24': '',
            '16x16': '',
            '32x32': '',
          },
        },
        issue: {
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
          labels: ['bug'],
          created: '2024-01-01T00:00:00.000Z',
          updated: '2024-01-01T00:00:00.000Z',
          comments: [],
        },
      };

      // Mock the document service processing
      documentService.processJiraIssue.mockResolvedValue();

      await service.processWebhookEvent(mockEvent);

      expect(documentService.processJiraIssue).toHaveBeenCalledWith(mockEvent.issue);
    });

    it('should process issue updated event', async () => {
      const mockEvent: JiraWebhookEvent = {
        timestamp: Date.now(),
        webhookEvent: 'jira:issue_updated',
        user: {
          accountId: 'user1',
          displayName: 'John Doe',
          avatarUrls: {
            '48x48': '',
            '24x24': '',
            '16x16': '',
            '32x32': '',
          },
        },
        issue: {
          id: 'ISSUE-123',
          key: 'PROJ-123',
          summary: 'Updated Issue',
          issueType: 'Bug',
          status: 'In Progress',
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
          labels: ['bug'],
          created: '2024-01-01T00:00:00.000Z',
          updated: '2024-01-01T01:00:00.000Z',
          comments: [],
        },
        changelog: {
          id: 'changelog-1',
          items: [
            {
              field: 'status',
              fieldtype: 'jira',
              from: '1',
              fromString: 'Open',
              to: '3',
              toString: 'In Progress',
            },
          ],
        },
      };

      documentService.processJiraIssue.mockResolvedValue();

      await service.processWebhookEvent(mockEvent);

      expect(documentService.processJiraIssue).toHaveBeenCalledWith(mockEvent.issue);
    });

    it('should ignore non-issue events', async () => {
      const mockEvent = {
        timestamp: Date.now(),
        webhookEvent: 'jira:project_created',
        user: {
          accountId: 'user1',
          displayName: 'John Doe',
          avatarUrls: {
            '48x48': '',
            '24x24': '',
            '16x16': '',
            '32x32': '',
          },
        },
      } as any;

      documentService.processJiraIssue.mockResolvedValue();

      await service.processWebhookEvent(mockEvent);

      expect(documentService.processJiraIssue).not.toHaveBeenCalled();
    });
  });

  describe('shouldProcessIssue', () => {
    it('should process high priority bugs', () => {
      const issue: Partial<JiraIssue> = {
        issueType: 'Bug',
        priority: 'High',
        labels: ['critical'],
        comments: [],
      };

      const result = (service as any).shouldProcessIssue(issue);

      expect(result).toBe(true);
    });

    it('should process stories with specific labels', () => {
      const issue: Partial<JiraIssue> = {
        issueType: 'Story',
        priority: 'Medium',
        labels: ['feature', 'documentation'],
        comments: [],
      };

      const result = (service as any).shouldProcessIssue(issue);

      expect(result).toBe(true);
    });

    it('should not process low priority tasks without special labels', () => {
      const issue: Partial<JiraIssue> = {
        issueType: 'Task',
        priority: 'Low',
        labels: ['minor'],
        comments: [],
      };

      const result = (service as any).shouldProcessIssue(issue);

      expect(result).toBe(false);
    });

    it('should process epics regardless of priority', () => {
      const issue: Partial<JiraIssue> = {
        issueType: 'Epic',
        priority: 'Low',
        labels: [],
        comments: [],
      };

      const result = (service as any).shouldProcessIssue(issue);

      expect(result).toBe(true);
    });
  });

  describe('extractIssueContent', () => {
    it('should extract content from issue with comments', () => {
      const issue: JiraIssue = {
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
        components: [
          {
            id: 'comp1',
            name: 'Frontend',
            description: 'Frontend component',
          },
        ],
        labels: ['bug', 'frontend'],
        created: '2024-01-01T00:00:00.000Z',
        updated: '2024-01-01T01:00:00.000Z',
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

      const result = (service as any).extractIssueContent(issue);

      expect(result).toContain('Test Issue');
      expect(result).toContain('Test Description');
      expect(result).toContain('Jane Smith');
      expect(result).toContain('I can reproduce this issue');
      expect(result).toContain('Frontend');
      expect(result).toContain('bug, frontend');
    });

    it('should handle issue without description and comments', () => {
      const issue: JiraIssue = {
        id: 'ISSUE-123',
        key: 'PROJ-123',
        summary: 'Simple Issue',
        issueType: 'Task',
        status: 'Open',
        priority: 'Medium',
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
        comments: [],
      };

      const result = (service as any).extractIssueContent(issue);

      expect(result).toContain('Simple Issue');
      expect(result).not.toContain('Description:');
      expect(result).not.toContain('Comments:');
    });
  });
}); 
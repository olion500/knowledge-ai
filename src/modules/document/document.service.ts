import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlackService } from '../slack/slack.service';
import { LLMService } from '../llm/llm.service';
import { GitHubService } from '../github/github.service';
import { SlackMessage } from '../../common/interfaces/slack.interface';
import { JiraIssue } from '../../common/interfaces/jira.interface';
import {
  SummaryRequest,
  ClassificationRequest,
  DocumentGenerationRequest,
  DocumentSimilarityRequest,
} from '../../common/interfaces/llm.interface';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly availableTopics: string[] = [
    'product-planning',
    'technical-architecture',
    'bug-reports',
    'feature-requests',
    'team-decisions',
    'project-updates',
    'security',
    'performance',
    'user-feedback',
    'general-discussion',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly slackService: SlackService,
    private readonly llmService: LLMService,
    private readonly githubService: GitHubService,
  ) {}

  async processSlackMessages(messages: SlackMessage[]): Promise<void> {
    this.logger.log(`Processing ${messages.length} Slack messages`);

    try {
      // Group messages by conversation/thread
      const conversations = this.groupSlackMessages(messages);

      for (const conversation of conversations) {
        await this.processConversation(conversation, 'slack');
      }
    } catch (error) {
      this.logger.error('Failed to process Slack messages', error);
      throw error;
    }
  }

  async processJiraIssue(issue: JiraIssue): Promise<void> {
    this.logger.log(`Processing Jira issue: ${issue.key}`);

    try {
      await this.processConversation([issue], 'jira');
    } catch (error) {
      this.logger.error(`Failed to process Jira issue ${issue.key}`, error);
      throw error;
    }
  }

  private async processConversation(
    content: SlackMessage[] | JiraIssue[],
    source: 'slack' | 'jira',
  ): Promise<void> {
    // Step 1: Prepare content for LLM processing
    const contentText = await this.prepareContentForLLM(content, source);
    const context = await this.extractContext(content, source);

    // Step 2: Summarize content
    const summaryRequest: SummaryRequest = {
      content: contentText,
      contentType: source,
      context,
    };

    const summary = await this.llmService.summarizeContent(summaryRequest);
    this.logger.log(`Generated summary for ${source} content`);

    // Step 3: Classify content
    const classificationRequest: ClassificationRequest = {
      content: contentText,
      availableTopics: this.availableTopics,
      context: {
        source,
        metadata: context,
      },
    };

    const classification = await this.llmService.classifyContent(classificationRequest);
    this.logger.log(`Classified content as topic: ${classification.topic}`);

    // Step 4: Check for existing document
    const existingDocument = await this.githubService.findExistingDocument(
      classification.topic,
    );

    let existingContent: string | undefined;
    if (existingDocument) {
      const fileContent = await this.githubService.getFileContent(
        existingDocument.path,
      );
      if (fileContent && fileContent.content) {
        existingContent = Buffer.from(fileContent.content, 'base64').toString('utf-8');
        
        // Step 4.5: Check similarity with existing document
        this.logger.log(`Found existing document for topic ${classification.topic}, checking similarity...`);
        
        const similarityThreshold = parseFloat(this.configService.get<string>('SIMILARITY_THRESHOLD', '0.7'));
        this.logger.log(`Using similarity threshold: ${similarityThreshold}`);
        
        const similarityRequest: DocumentSimilarityRequest = {
          existingContent,
          newSummary: summary,
          classification,
          similarityThreshold,
          context: {
            source,
            participants: summary.participants,
          },
        };

        const similarity = await this.llmService.compareDocumentSimilarity(similarityRequest);
        
        // Server-side similarity determination
        const isSimilar = similarity.similarityScore > similarityThreshold;
        
        this.logger.log(`Similarity check result: ${isSimilar ? 'Similar' : 'Different'} (score: ${similarity.similarityScore})`);
        this.logger.log(`Reasoning: ${similarity.reasoning}`);

        if (isSimilar) {
          this.logger.log('Content is too similar to existing document, skipping PR creation');
          this.logger.log(`Key differences found: ${similarity.keyDifferences.join(', ')}`);
          return; // Exit early, don't create PR
        } else {
          this.logger.log('Content is sufficiently different, proceeding with document update');
          if (similarity.keyDifferences.length > 0) {
            this.logger.log(`Key differences: ${similarity.keyDifferences.join(', ')}`);
          }
        }
      }
    }

    // Step 5: Generate document
    const documentRequest: DocumentGenerationRequest = {
      summary,
      classification,
      originalContent: {
        source,
        data: content,
        timestamp: new Date().toISOString(),
      },
      existingDocument: existingContent,
    };

    const document = await this.llmService.generateDocument(documentRequest);
    this.logger.log(`Generated document: ${document.title}`);

    // Step 6: Create GitHub branch and file (with error handling)
    try {
      const branchName = `knowledge-sync/${classification.topic}-${Date.now()}`;
      await this.githubService.createBranch(branchName);

      const filePath = await this.githubService.generateDocumentPath(
        classification.topic,
        document.title,
      );

      const commitMessage = document.isUpdate
        ? `Update ${classification.topic} documentation: ${document.title}`
        : `Add ${classification.topic} documentation: ${document.title}`;

      await this.githubService.createOrUpdateFile(
        filePath,
        document.content,
        commitMessage,
        branchName,
      );

      // Step 7: Create Pull Request
      const defaultReviewers = this.configService
        .get<string>('DEFAULT_REVIEWERS', '')
        .split(',')
        .map(reviewer => reviewer.trim())
        .filter(Boolean);

      this.logger.log(`Configured reviewers: ${defaultReviewers.length > 0 ? defaultReviewers.join(', ') : 'none'}`);

      const prTitle = document.isUpdate
        ? `📝 Update: ${document.title}`
        : `📄 New: ${document.title}`;

      const prBody = this.generatePRDescription(document, summary, classification, source);

      const pullRequest = await this.githubService.createPullRequest({
        title: prTitle,
        body: prBody,
        head: branchName,
        base: 'main',
        reviewers: defaultReviewers.length > 0 ? defaultReviewers : undefined,
        labels: ['documentation', `topic:${classification.topic}`, `source:${source}`],
      });

      this.logger.log(`Created PR #${pullRequest.number}: ${pullRequest.url}`);
    } catch (githubError) {
      this.logger.error('GitHub operations failed, but document processing completed successfully', githubError);
      this.logger.warn('Document was generated but not pushed to GitHub. Please check GitHub configuration and permissions.');
      
      // Log the document content for manual handling if needed
      this.logger.log(`Generated document content:\n${document.content}`);
      
      // Don't throw the error - allow the process to complete successfully
      // The LLM processing was successful even if GitHub integration failed
    }
  }

  private groupSlackMessages(messages: SlackMessage[]): SlackMessage[][] {
    const conversations: Map<string, SlackMessage[]> = new Map();

    for (const message of messages) {
      const key = message.threadTs || message.id;
      
      if (!conversations.has(key)) {
        conversations.set(key, []);
      }
      
      conversations.get(key)!.push(message);
    }

    return Array.from(conversations.values());
  }

  private async prepareContentForLLM(
    content: SlackMessage[] | JiraIssue[],
    source: 'slack' | 'jira',
  ): Promise<string> {
    if (source === 'slack') {
      const messages = content as SlackMessage[];
      const resolvedMessages: string[] = [];
      
      for (const msg of messages) {
        try {
          const userInfo = await this.slackService.getUserInfo(msg.user);
          const userName = userInfo?.realName || userInfo?.name || msg.user;
          resolvedMessages.push(`[${userName}]: ${msg.text}`);
        } catch (error) {
          this.logger.warn(`Failed to resolve user ${msg.user} in message content`, error);
          resolvedMessages.push(`[${msg.user}]: ${msg.text}`);
        }
      }
      
      return resolvedMessages.join('\n');
    } else {
      const issues = content as JiraIssue[];
      const issue = issues[0]; // Single issue for Jira
      
      let text = `Title: ${issue.summary}\n`;
      if (issue.description) {
        text += `Description: ${issue.description}\n`;
      }
      
      if (issue.comments.length > 0) {
        text += '\nComments:\n';
        text += issue.comments
          .map(comment => `[${comment.author.displayName}]: ${comment.body}`)
          .join('\n');
      }
      
      return text;
    }
  }

  private async extractContext(
    content: SlackMessage[] | JiraIssue[],
    source: 'slack' | 'jira',
  ): Promise<any> {
    if (source === 'slack') {
      const messages = content as SlackMessage[];
      const userIds = [...new Set(messages.map(msg => msg.user))];
      
      // Resolve user IDs to real names
      const participants = await this.resolveSlackUserNames(userIds);
      
      return {
        channel: messages[0]?.channel,
        participants,
        messageCount: messages.length,
      };
    } else {
      const issues = content as JiraIssue[];
      const issue = issues[0];
      
      const participants = [
        issue.reporter.displayName,
        ...(issue.assignee ? [issue.assignee.displayName] : []),
        ...issue.comments.map(comment => comment.author.displayName),
      ];
      
      return {
        project: issue.project.key,
        participants: [...new Set(participants)],
        issueType: issue.issueType,
        priority: issue.priority,
        status: issue.status,
        components: issue.components.map(c => c.name),
        labels: issue.labels,
      };
    }
  }

  private async resolveSlackUserNames(userIds: string[]): Promise<string[]> {
    const names: string[] = [];
    
    for (const userId of userIds) {
      try {
        const userInfo = await this.slackService.getUserInfo(userId);
        if (userInfo) {
          // Prefer real name, fallback to username, then user ID
          names.push(userInfo.realName || userInfo.name || userId);
        } else {
          names.push(userId);
        }
      } catch (error) {
        this.logger.warn(`Failed to resolve user ${userId}, using ID instead`, error);
        names.push(userId);
      }
    }
    
    return names;
  }

  private generatePRDescription(
    document: any,
    summary: any,
    classification: any,
    source: string,
  ): string {
    return `
## 📝 Documentation Update

**Topic**: ${classification.topic} (${(classification.confidence * 100).toFixed(1)}% confidence)  
**Source**: ${source.toUpperCase()}  
**Participants**: ${summary.participants.join(', ')}

### Summary
${summary.summary}

${document.isUpdate ? `### Changes
${document.changesSummary}` : ''}

---
*Automatically generated by Knowledge Sync AI*
`;
  }
} 
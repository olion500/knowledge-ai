import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider } from '../../common/interfaces/llm-provider.interface';
import { LLMProviderFactory } from './providers/llm-provider.factory';
import {
  SummaryRequest,
  SummaryResponse,
  ClassificationRequest,
  ClassificationResponse,
  DocumentGenerationRequest,
  DocumentGenerationResponse,
} from '../../common/interfaces/llm.interface';

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private readonly provider: LLMProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmProviderFactory: LLMProviderFactory,
  ) {
    this.provider = this.llmProviderFactory.createProvider();
  }

  async summarizeContent(request: SummaryRequest): Promise<SummaryResponse> {
    try {
      const prompt = this.buildSummaryPrompt(request);
      
      const completion = await this.provider.createCompletion({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
      });

      if (!completion.content) {
        throw new Error('No response from LLM provider');
      }

      const parsed = JSON.parse(completion.content) as SummaryResponse;
      
      this.logger.log(`Summarized ${request.contentType} content successfully using ${this.provider.getModel()}`);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to summarize content', error);
      throw error;
    }
  }

  async classifyContent(request: ClassificationRequest): Promise<ClassificationResponse> {
    try {
      const prompt = this.buildClassificationPrompt(request);
      
      const completion = await this.provider.createCompletion({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });

      if (!completion.content) {
        throw new Error('No response from LLM provider');
      }

      const parsed = JSON.parse(completion.content) as ClassificationResponse;
      
      this.logger.log(`Classified content as topic: ${parsed.topic} using ${this.provider.getModel()}`);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to classify content', error);
      throw error;
    }
  }

  async generateDocument(request: DocumentGenerationRequest): Promise<DocumentGenerationResponse> {
    try {
      const prompt = this.buildDocumentGenerationPrompt(request);
      
      const completion = await this.provider.createCompletion({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
      });

      if (!completion.content) {
        throw new Error('No response from LLM provider');
      }

      const parsed = JSON.parse(completion.content) as DocumentGenerationResponse;
      
      this.logger.log(`Generated document: ${parsed.title} using ${this.provider.getModel()}`);
      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate document', error);
      throw error;
    }
  }

  async checkProviderAvailability(): Promise<{ available: boolean; provider: string; model: string }> {
    const available = await this.provider.isAvailable();
    return {
      available,
      provider: this.provider.constructor.name,
      model: this.provider.getModel(),
    };
  }

  private buildSummaryPrompt(request: SummaryRequest): string {
    const contextInfo = request.context ? `
Context:
- Channel/Project: ${request.context.channel || request.context.project || 'Unknown'}
- Participants: ${request.context.participants?.join(', ') || 'Unknown'}
` : '';

    return `
You are an AI assistant that summarizes ${request.contentType} conversations and issues.

${contextInfo}

Content to summarize:
${request.content}

Please provide a JSON response with the following structure:
{
  "summary": "A concise summary of the main discussion points",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "decisions": ["Decision 1", "Decision 2", ...],
  "actionItems": ["Action item 1", "Action item 2", ...],
  "participants": ["participant1", "participant2", ...],
  "tags": ["tag1", "tag2", ...]
}

Focus on:
- Main discussion topics and outcomes
- Important decisions made
- Action items and assignments
- Key participants involved
- Relevant tags for categorization
`;
  }

  private buildClassificationPrompt(request: ClassificationRequest): string {
    const availableTopics = request.availableTopics.join(', ');
    const contextInfo = request.context ? `
Source: ${request.context.source}
Additional context: ${JSON.stringify(request.context.metadata || {})}
` : '';

    return `
You are an AI assistant that classifies content into predefined topics.

${contextInfo}

Available topics: ${availableTopics}

Content to classify:
${request.content}

Please provide a JSON response with the following structure:
{
  "topic": "The most appropriate topic from the available list",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this topic was chosen",
  "suggestedTags": ["tag1", "tag2", ...]
}

Choose the topic that best matches the content. If no topic is a good fit, choose the closest one and explain in the reasoning.
`;
  }

  private buildDocumentGenerationPrompt(request: DocumentGenerationRequest): string {
    const isUpdate = !!request.existingDocument;
    const existingDocSection = isUpdate ? `
Existing document to update:
${request.existingDocument}
` : '';

    return `
You are an AI assistant that generates markdown documentation from summarized content.

${existingDocSection}

Summary data:
${JSON.stringify(request.summary, null, 2)}

Classification:
${JSON.stringify(request.classification, null, 2)}

Original content metadata:
- Source: ${request.originalContent.source}
- Timestamp: ${request.originalContent.timestamp}

Please provide a JSON response with the following structure:
{
  "title": "Document title",
  "content": "Full markdown content of the document",
  "metadata": {
    "topic": "topic name",
    "tags": ["tag1", "tag2"],
    "lastUpdated": "ISO timestamp",
    "sources": ["source1", "source2"],
    "participants": ["person1", "person2"]
  },
  "isUpdate": ${isUpdate},
  ${isUpdate ? '"changesSummary": "Summary of what changed",' : ''}
}

The markdown content should include:
- Clear title and overview
- Key decisions and outcomes
- Action items with assignees
- Relevant links and references
- Proper markdown formatting

${isUpdate ? 'If updating an existing document, merge the new information appropriately and provide a changes summary.' : 'Create a new, well-structured document.'}
`;
  }
} 
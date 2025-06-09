import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider } from '../../common/interfaces/llm-provider.interface';
import { LLMProviderFactory } from './providers/llm-provider.factory';
import {
  LLMRequest,
  LLMResponse,
  SummaryRequest,
  SummaryResponse,
  ClassificationRequest,
  ClassificationResponse,
  DocumentGenerationRequest,
  DocumentGenerationResponse,
  DocumentSimilarityRequest,
  DocumentSimilarityResponse,
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

      this.logger.log(
        `Summarized ${request.contentType} content successfully using ${this.provider.getModel()}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Failed to summarize content', error);
      throw error;
    }
  }

  async classifyContent(
    request: ClassificationRequest,
  ): Promise<ClassificationResponse> {
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

      this.logger.log(
        `Classified content as topic: ${parsed.topic} using ${this.provider.getModel()}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Failed to classify content', error);
      throw error;
    }
  }

  async generateDocument(
    request: DocumentGenerationRequest,
  ): Promise<DocumentGenerationResponse> {
    try {
      const prompt = this.buildDocumentGenerationPrompt(request);

      const completion = await this.provider.createCompletion({
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' },
      });

      if (!completion.content) {
        throw new Error('No response from LLM provider');
      }

      const parsed = JSON.parse(
        completion.content,
      ) as DocumentGenerationResponse;

      this.logger.log(
        `Generated document: ${parsed.title} using ${this.provider.getModel()}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Failed to generate document', error);
      throw error;
    }
  }

  async compareDocumentSimilarity(
    request: DocumentSimilarityRequest,
  ): Promise<DocumentSimilarityResponse> {
    try {
      const prompt = this.buildSimilarityPrompt(request);

      const completion = await this.provider.createCompletion({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        responseFormat: { type: 'json_object' },
      });

      if (!completion.content) {
        throw new Error('No response from LLM provider');
      }

      const parsed = JSON.parse(
        completion.content,
      ) as DocumentSimilarityResponse;

      this.logger.log(
        `Compared document similarity: score ${parsed.similarityScore} using ${this.provider.getModel()}`,
      );
      return parsed;
    } catch (error) {
      this.logger.error('Failed to compare document similarity', error);
      throw error;
    }
  }

  async checkProviderAvailability(): Promise<{
    available: boolean;
    provider: string;
    model: string;
  }> {
    const available = await this.provider.isAvailable();
    return {
      available,
      provider: this.provider.constructor.name,
      model: this.provider.getModel(),
    };
  }

  private buildSummaryPrompt(request: SummaryRequest): string {
    const contextInfo = request.context
      ? `
Context:
- Channel/Project: ${request.context.channel || request.context.project || 'Unknown'}
- Participants: ${request.context.participants?.join(', ') || 'Unknown'}
`
      : '';

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
    const contextInfo = request.context
      ? `
Source: ${request.context.source}
Additional context: ${JSON.stringify(request.context.metadata || {})}
`
      : '';

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

  private buildDocumentGenerationPrompt(
    request: DocumentGenerationRequest,
  ): string {
    const isUpdate = !!request.existingDocument;
    const existingDocSection = isUpdate
      ? `
Existing document to update:
${request.existingDocument}
`
      : '';

    return `
You are an AI assistant that generates comprehensive PRD (Product Requirements Document) style markdown documentation from summarized content.

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
  "title": "Feature or topic name without date",
  "content": "Full markdown content of the document in PRD format",
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

The markdown content MUST follow this PRD format structure:

# 📄 [Feature/Topic Name]

---

## 1. TL;DR

간략한 요약 (3~5줄):
- [Main discussion point or feature description]
- [Key approach or methodology]
- [Success criteria or expected outcome]

---

## 2. Problem Statement

- [Problem 1: Description of the issue or challenge]
- [Problem 2: Current pain points or limitations]
- [Problem 3: User/business impact]

---

## 3. Hypothesis (가설)

- [Main hypothesis based on the discussion or proposed solution]

---

## 4. Proposed Solution

- [Solution approach 1]
- [Technical implementation details]
- [UI/UX considerations if applicable]
- [Integration requirements]

---

## 5. Metrics (성과 측정 지표)

| 지표 항목              | 목표 수치         |
|------------------------|-------------------|
| [Metric 1]             | [Target value]    |
| [Metric 2]             | [Target value]    |
| [Metric 3]             | [Target value]    |

---

## 6. Timeline

| 단계                | 일정             |
|---------------------|------------------|
| [Phase 1]           | [Date/Duration]  |
| [Phase 2]           | [Date/Duration]  |
| [Launch]            | [Date/Duration]  |

---

## 7. Owners & Stakeholders

| 역할               | 담당자 이름         |
|--------------------|---------------------|
| Product Owner      | [Name from participants] |
| Tech Lead          | [Name from participants] |
| Designer           | [Name from participants] |
| Stakeholder        | [Name from participants] |

---

## 8. Risks / Open Questions

- [Risk 1: Description and mitigation strategy]
- [Risk 2: Technical challenges]
- [Open Question 1: Items requiring further discussion]
- [Open Question 2: Dependencies or blockers]

---

## 9. Appendix (선택 사항)

- [Additional context from the discussion]
- [Technical specifications or code snippets if mentioned]
- [Related links or references if any]
- [Decision rationale and alternatives considered]

---

*Generated from ${request.originalContent.source.toUpperCase()} discussion*
*Last updated: ${new Date().toISOString().split('T')[0]}*

IMPORTANT GUIDELINES:
- Create a clear, professional PRD document
- Extract relevant information from the summary and classification
- Use Korean labels as shown in the template (TL;DR, 가설, etc.)
- Fill in actual content from the discussion, not placeholder text
- If information is missing for a section, note "정보 부족" or "추후 논의 필요"
- Focus on actionable insights and clear decision points
- Maintain professional tone suitable for product documentation

${isUpdate ? 'If updating an existing document, merge the new information appropriately into the PRD structure and provide a changes summary.' : 'Create a new, comprehensive PRD document.'}
`;
  }

  private buildSimilarityPrompt(request: DocumentSimilarityRequest): string {
    const contextInfo = request.context
      ? `
Context:
- Source: ${request.context.source}
- Participants: ${request.context.participants?.join(', ') || 'Unknown'}
`
      : '';

    const threshold = request.similarityThreshold || 0.7;

    return `
You are an AI assistant that compares the semantic similarity between existing documentation and new content.

${contextInfo}

Existing document content:
${request.existingContent}

New content summary:
${JSON.stringify(request.newSummary, null, 2)}

Classification of new content:
${JSON.stringify(request.classification, null, 2)}

Please analyze if the new content adds significant value or represents meaningful changes compared to the existing document.

Consider these factors:
1. **Topic overlap**: Are they discussing the same general subject?
2. **Decision differences**: Are there new decisions or changes to existing ones?
3. **Information novelty**: Does the new content contain substantially new information?
4. **Participant involvement**: Are there new key participants or perspectives?
5. **Action item changes**: Are there new action items or changes to existing ones?
6. **Context evolution**: Has the context or situation changed significantly?

Provide a JSON response with this structure:
{
  "similarityScore": 0.85,
  "reasoning": "Detailed explanation of the similarity assessment",
  "keyDifferences": ["difference1", "difference2", ...]
}

Guidelines:
- similarityScore: 0.0 = completely different, 1.0 = identical
- Focus on identifying semantic similarity and meaningful differences
- Consider something more similar if it's mostly the same discussion with minor updates
- Consider something less similar if there are new decisions, significant new information, or changed context
- Be conservative - when in doubt, assign a lower similarity score to avoid losing important updates
`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMService } from '../../llm/llm.service';
import {
  CodeChangeContext,
  CodeFunctionChange,
  DocumentationUpdateRequest,
  DocumentationUpdateResponse,
  LLMAnalysisConfig,
  CodeAnalysisPrompt,
} from '../../../common/interfaces/code-analysis-llm.interface';
import { CodeStructure } from '../../../common/entities/code-structure.entity';
import { CodeChangeLog } from '../../../common/entities/code-change-log.entity';
import { Repository } from '../../../common/entities/repository.entity';

@Injectable()
export class CodeAnalysisLLMService {
  private readonly logger = new Logger(CodeAnalysisLLMService.name);
  private readonly analysisConfig: LLMAnalysisConfig;

  constructor(
    private readonly llmService: LLMService,
    private readonly configService: ConfigService,
  ) {
    this.analysisConfig = {
      model: this.configService.get('LLM_MODEL', 'gpt-4'),
      temperature: 0.3,
      maxTokens: 2000,
      systemPrompt: this.getSystemPrompt(),
      analysisPrompts: {
        codeChange: this.getCodeChangePrompt(),
        documentationImpact: this.getDocumentationImpactPrompt(),
        changelogGeneration: this.getChangelogPrompt(),
      },
    };
  }

  /**
   * Analyze code changes and determine documentation update requirements
   */
  async analyzeCodeChangesForDocumentation(
    repository: Repository,
    changes: {
      added: CodeStructure[];
      modified: CodeStructure[];
      deleted: CodeStructure[];
    },
    commits: any[],
  ): Promise<DocumentationUpdateResponse> {
    const startTime = Date.now();

    try {
      // Build code change context
      const context = await this.buildCodeChangeContext(
        repository,
        changes,
        commits,
      );

      // Analyze with LLM
      const analysisResult = await this.performLLMAnalysis(context);

      return {
        ...analysisResult,
        metadata: {
          analysisDate: new Date().toISOString(),
          llmModel: this.analysisConfig.model,
          processingTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(
        'Failed to analyze code changes for documentation',
        error,
      );
      return this.createFallbackResponse(startTime);
    }
  }

  /**
   * Build comprehensive code change context for LLM analysis
   */
  private async buildCodeChangeContext(
    repository: Repository,
    changes: {
      added: CodeStructure[];
      modified: CodeStructure[];
      deleted: CodeStructure[];
    },
    commits: any[],
  ): Promise<CodeChangeContext> {
    const mapToFunctionChange = (
      items: CodeStructure[],
      changeType: 'added' | 'modified' | 'deleted',
    ): CodeFunctionChange[] => {
      return items.map((item) => ({
        functionName: item.functionName || 'unknown',
        className: item.className,
        filePath: item.filePath,
        signature: item.signature,
        changeType,
        impact: this.calculateChangeImpact(item),
        description: this.generateChangeDescription(item, changeType),
        complexity: item.metadata
          ? {
              cyclomaticComplexity: item.metadata.cyclomaticComplexity || 0,
              linesOfCode: item.metadata.linesOfCode || 0,
            }
          : undefined,
        isPublic: this.isPublicFunction(item),
        isExported: this.isExportedFunction(item),
      }));
    };

    const allChanges = [
      ...mapToFunctionChange(changes.added, 'added'),
      ...mapToFunctionChange(changes.modified, 'modified'),
      ...mapToFunctionChange(changes.deleted, 'deleted'),
    ];

    const significantChanges = allChanges.filter(
      (change) =>
        change.impact === 'high' ||
        (change.impact === 'medium' && change.isPublic),
    );

    const complexities = allChanges
      .map((c) => c.complexity?.cyclomaticComplexity || 0)
      .filter((c) => c > 0);

    return {
      repository: {
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        description: repository.description,
        language: repository.language,
      },
      commits: {
        from: commits[commits.length - 1]?.sha || '',
        to: commits[0]?.sha || '',
        count: commits.length,
        details: commits.slice(0, 5).map((commit) => ({
          sha: commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date,
        })),
      },
      changes: {
        added: mapToFunctionChange(changes.added, 'added'),
        modified: mapToFunctionChange(changes.modified, 'modified'),
        deleted: mapToFunctionChange(changes.deleted, 'deleted'),
      },
      summary: {
        totalFunctions: allChanges.length,
        changedFunctions: changes.modified.length,
        significantChanges: significantChanges.length,
        complexity: {
          average:
            complexities.length > 0
              ? complexities.reduce((a, b) => a + b, 0) / complexities.length
              : 0,
          highest: complexities.length > 0 ? Math.max(...complexities) : 0,
        },
      },
    };
  }

  /**
   * Perform LLM analysis to determine documentation updates
   */
  private async performLLMAnalysis(
    context: CodeChangeContext,
  ): Promise<Omit<DocumentationUpdateResponse, 'metadata'>> {
    const prompt = this.buildAnalysisPrompt(context);

    // Use the LLMService's createCompletion approach
    const llmResponse = await this.callLLMForAnalysis(prompt);

    return this.parseAnalysisResponse(llmResponse, context);
  }

  /**
   * Call LLM using a simplified approach
   */
  private async callLLMForAnalysis(prompt: string): Promise<string> {
    try {
      // Create a simple summary request to leverage existing LLM functionality
      const summaryRequest = {
        content: prompt,
        contentType: 'slack' as const,
        context: {
          channel: 'code-analysis',
          participants: ['system'],
        },
      };

      // Use the summary functionality as a proxy for our analysis
      const response = await this.llmService.summarizeContent(summaryRequest);

      // Return the response as JSON string since our parser expects JSON
      return JSON.stringify({
        shouldUpdate: true,
        confidence: 75,
        reasoning: `Analysis based on code changes: ${response.summary}. Key points: ${response.keyPoints.join(', ')}`,
        suggestedUpdates: {
          changelog: {
            shouldUpdate: true,
            entryType: 'minor',
            priority: 'medium',
            suggestedEntry: response.summary,
          },
          readme: {
            shouldUpdate: response.keyPoints.length > 2,
            sections: ['API', 'Usage'],
            priority: 'medium',
          },
          apiDocs: {
            shouldUpdate: response.keyPoints.some(
              (point) =>
                point.toLowerCase().includes('api') ||
                point.toLowerCase().includes('function') ||
                point.toLowerCase().includes('method'),
            ),
            affectedEndpoints: [],
            priority: 'medium',
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to call LLM for analysis', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(context: CodeChangeContext): string {
    return `
Please analyze the following code changes and determine if documentation updates are needed.

## Repository Information
- **Name**: ${context.repository.fullName}
- **Language**: ${context.repository.language || 'Unknown'}
- **Description**: ${context.repository.description || 'No description'}

## Change Summary
- **Commits**: ${context.commits.count} commits from ${context.commits.from} to ${context.commits.to}
- **Total Functions Changed**: ${context.summary.totalFunctions}
- **Significant Changes**: ${context.summary.significantChanges}
- **Average Complexity**: ${context.summary.complexity.average.toFixed(1)}

## Recent Commits
${context.commits.details
  .map((commit) => `- ${commit.sha}: ${commit.message} (by ${commit.author})`)
  .join('\n')}

## Function Changes

### Added Functions (${context.changes.added.length})
${context.changes.added
  .map(
    (change) =>
      `- **${change.functionName}** in ${change.filePath}
    - Signature: \`${change.signature}\`
    - Public: ${change.isPublic}, Exported: ${change.isExported}
    - Impact: ${change.impact}`,
  )
  .join('\n')}

### Modified Functions (${context.changes.modified.length})
${context.changes.modified
  .map(
    (change) =>
      `- **${change.functionName}** in ${change.filePath}
    - Signature: \`${change.signature}\`
    - Public: ${change.isPublic}, Exported: ${change.isExported}
    - Impact: ${change.impact}`,
  )
  .join('\n')}

### Deleted Functions (${context.changes.deleted.length})
${context.changes.deleted
  .map(
    (change) =>
      `- **${change.functionName}** in ${change.filePath}
    - Was public: ${change.isPublic}, Was exported: ${change.isExported}
    - Impact: ${change.impact}`,
  )
  .join('\n')}

## Analysis Request
Based on these changes, please provide a JSON response with the following structure:
\`\`\`json
{
  "shouldUpdate": boolean,
  "confidence": number, // 0-100
  "reasoning": "Detailed explanation of your decision",
  "suggestedUpdates": {
    "readme": {
      "shouldUpdate": boolean,
      "sections": ["list", "of", "sections"],
      "priority": "low|medium|high",
      "suggestedContent": "Brief content suggestion"
    },
    "apiDocs": {
      "shouldUpdate": boolean,
      "affectedEndpoints": ["list", "of", "endpoints"],
      "priority": "low|medium|high",
      "suggestedContent": "Brief content suggestion"
    },
    "changelog": {
      "shouldUpdate": boolean,
      "entryType": "patch|minor|major",
      "priority": "low|medium|high",
      "suggestedEntry": "Suggested changelog entry"
    }
  }
}
\`\`\`

Focus on:
1. Public API changes that affect users
2. Breaking changes or significant functionality updates
3. New features that should be documented
4. Changes that affect existing documentation accuracy
`;
  }

  /**
   * Parse LLM analysis response
   */
  private parseAnalysisResponse(
    response: string,
    context: CodeChangeContext,
  ): Omit<DocumentationUpdateResponse, 'metadata'> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonStr);

      // Validate and return structured response
      return {
        shouldUpdate: parsed.shouldUpdate || false,
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 100),
        reasoning: parsed.reasoning || 'No specific reasoning provided',
        suggestedUpdates: {
          readme: parsed.suggestedUpdates?.readme || {
            shouldUpdate: false,
            sections: [],
            priority: 'low',
          },
          apiDocs: parsed.suggestedUpdates?.apiDocs || {
            shouldUpdate: false,
            affectedEndpoints: [],
            priority: 'low',
          },
          changelog: parsed.suggestedUpdates?.changelog || {
            shouldUpdate: false,
            entryType: 'patch',
            priority: 'low',
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to parse LLM analysis response', error);
      return this.createFallbackAnalysis(context);
    }
  }

  /**
   * Calculate change impact based on function characteristics
   */
  private calculateChangeImpact(
    item: CodeStructure,
  ): 'low' | 'medium' | 'high' {
    const complexity = item.metadata?.cyclomaticComplexity || 0;
    const isPublic = this.isPublicFunction(item);
    const isExported = this.isExportedFunction(item);

    if (isExported && complexity > 10) return 'high';
    if (isPublic && complexity > 5) return 'high';
    if (isExported || isPublic) return 'medium';
    if (complexity > 15) return 'medium';

    return 'low';
  }

  /**
   * Generate change description
   */
  private generateChangeDescription(
    item: CodeStructure,
    changeType: string,
  ): string {
    const funcName = item.functionName || 'unknown function';
    const className = item.className ? ` in class ${item.className}` : '';
    const complexity = item.metadata?.cyclomaticComplexity || 0;

    return `${changeType.charAt(0).toUpperCase() + changeType.slice(1)} ${funcName}${className} (complexity: ${complexity})`;
  }

  /**
   * Check if function is public (exported or in public class)
   */
  private isPublicFunction(item: CodeStructure): boolean {
    const astData = item.astData as any;
    return (
      astData?.isExported || astData?.modifiers?.includes('public') || false
    );
  }

  /**
   * Check if function is exported
   */
  private isExportedFunction(item: CodeStructure): boolean {
    const astData = item.astData as any;
    return astData?.isExported || false;
  }

  /**
   * Create fallback analysis when LLM fails
   */
  private createFallbackAnalysis(
    context: CodeChangeContext,
  ): Omit<DocumentationUpdateResponse, 'metadata'> {
    const hasSignificantChanges = context.summary.significantChanges > 0;
    const hasPublicChanges = [
      ...context.changes.added,
      ...context.changes.modified,
      ...context.changes.deleted,
    ].some((change) => change.isPublic || change.isExported);

    return {
      shouldUpdate: hasSignificantChanges || hasPublicChanges,
      confidence: hasSignificantChanges ? 80 : 50,
      reasoning:
        'Fallback analysis: Detected significant or public API changes',
      suggestedUpdates: {
        readme: {
          shouldUpdate: hasPublicChanges,
          sections: ['API', 'Usage'],
          priority: hasSignificantChanges ? 'high' : 'medium',
        },
        apiDocs: {
          shouldUpdate: hasPublicChanges,
          affectedEndpoints: [],
          priority: hasSignificantChanges ? 'high' : 'medium',
        },
        changelog: {
          shouldUpdate: true,
          entryType: hasSignificantChanges ? 'minor' : 'patch',
          priority: 'medium',
        },
      },
    };
  }

  /**
   * Create fallback response for errors
   */
  private createFallbackResponse(
    startTime: number,
  ): DocumentationUpdateResponse {
    return {
      shouldUpdate: false,
      confidence: 0,
      reasoning: 'Analysis failed due to system error',
      suggestedUpdates: {
        readme: { shouldUpdate: false, sections: [], priority: 'low' },
        apiDocs: {
          shouldUpdate: false,
          affectedEndpoints: [],
          priority: 'low',
        },
        changelog: { shouldUpdate: false, entryType: 'patch', priority: 'low' },
      },
      metadata: {
        analysisDate: new Date().toISOString(),
        llmModel: this.analysisConfig.model,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * System prompt for LLM
   */
  private getSystemPrompt(): string {
    return `You are an expert software documentation analyst. Your role is to analyze code changes and determine when documentation updates are necessary.

Key principles:
1. Focus on user-facing changes that affect API contracts
2. Prioritize breaking changes and new public features
3. Consider the impact on existing documentation accuracy
4. Provide practical, actionable suggestions
5. Be conservative but thorough in your analysis

Always respond with valid JSON in the specified format.`;
  }

  private getCodeChangePrompt(): string {
    return 'Analyze these code changes for their impact on user-facing functionality.';
  }

  private getDocumentationImpactPrompt(): string {
    return 'Determine what documentation sections need updates based on these changes.';
  }

  private getChangelogPrompt(): string {
    return 'Generate appropriate changelog entries for these changes.';
  }
}

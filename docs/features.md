# Features

## 🎯 Core Features Overview

Knowledge AI provides intelligent knowledge management through automated conversation capture, AI-powered processing, and seamless documentation generation.

## 📥 Data Collection Features

### F001: Slack Message Processing

**Overview**: Automatically capture important conversations from Slack channels based on user reactions and keywords.

#### Trigger Mechanisms

**Reaction-Based Collection**
- **Supported Reactions**: 📝 (`:memo:`), 📋 (`:clipboard:`), 🔖 (`:bookmark_tabs:`)
- **Behavior**: Any message receiving these reactions is queued for processing
- **Context Capture**: Includes thread context, participant information, and timestamps
- **Rate Limiting**: Respects Slack API quotas with exponential backoff

**Keyword-Based Collection**
- **Supported Keywords**: "decision", "action item", "todo", "follow up", "next steps"
- **Case Sensitivity**: Case-insensitive matching
- **Context Window**: Captures surrounding conversation for context
- **False Positive Handling**: AI classification filters out non-relevant matches

#### Business Rules

**Message Inclusion Criteria**:
- ✅ Message must be in monitored channels
- ✅ User must have appropriate permissions
- ✅ Message must not be deleted or edited significantly
- ✅ Thread context must be accessible

**Message Exclusion Criteria**:
- ❌ Private messages (DMs) are never processed
- ❌ Bot messages are ignored unless explicitly configured
- ❌ Messages older than configured retention period
- ❌ Messages from blocked or restricted users

#### Edge Cases

**Thread Handling**:
- **Partial Threads**: If thread is partially accessible, processes available content
- **Long Threads**: Truncates extremely long threads (>10k characters) with summary
- **Cross-Channel References**: Attempts to resolve references but fails gracefully

**Rate Limit Scenarios**:
- **API Limits**: Queues requests and processes when quota resets
- **Burst Handling**: Implements exponential backoff for burst scenarios
- **Error Recovery**: Retries failed requests up to 3 times before marking as failed

### F002: Jira Integration

**Overview**: Process Jira issues and comments to capture project decisions and technical discussions.

#### Supported Events

**Issue Events**:
- **Created**: New issue creation triggers processing
- **Updated**: Field changes and status updates
- **Commented**: New comments on existing issues
- **Transitioned**: Status changes (e.g., In Progress → Done)

**Content Extraction**:
- **Issue Description**: Full description with markdown formatting
- **Comments**: All comments with author and timestamp information
- **Custom Fields**: Configurable custom field extraction
- **Attachments**: Reference to attachments (content not processed)

#### Business Rules

**Processing Criteria**:
- ✅ Issue must be in configured projects
- ✅ User must have read permissions
- ✅ Issue type must be in allowed list (configurable)
- ✅ Content must meet minimum length requirements

**Classification Logic**:
- **Bug Reports**: Issues with type "Bug" or containing bug-related keywords
- **Feature Requests**: Enhancement type issues
- **Technical Architecture**: Issues tagged with architecture labels
- **Project Updates**: Status change notifications

#### Edge Cases

**Permission Changes**:
- **Lost Access**: Gracefully handles cases where bot loses access to issues
- **Partial Access**: Processes available content when some fields are restricted
- **Project Deletion**: Handles deleted projects without causing system errors

**Content Handling**:
- **Large Issues**: Truncates extremely large issue descriptions
- **Rich Content**: Strips unsupported formatting but preserves structure
- **Deleted Comments**: Handles deleted or edited comments appropriately

### F003: Manual Collection API

**Overview**: Provide APIs for manual and bulk collection of historical data.

#### Endpoints

**Bulk Slack Collection**:
```typescript
POST /slack/collect
{
  "channelId": "C1234567890",
  "reactionName": "memo",
  "keywords": ["decision", "action item"],
  "hours": 24,
  "includeThreads": true
}
```

**Historical Jira Processing**:
```typescript
POST /jira/collect
{
  "projectKey": "PROJ",
  "issueTypes": ["Bug", "Epic"],
  "since": "2024-01-01",
  "until": "2024-12-31"
}
```

#### Business Rules

**Rate Limiting**:
- **Bulk Operations**: Limited to 1000 messages per request
- **Frequency**: Maximum 5 bulk requests per hour per user
- **Progress Tracking**: Long-running operations provide progress updates
- **Cancellation**: Support for cancelling in-progress operations

**Data Validation**:
- **Date Ranges**: Must be within allowed historical limits (default: 1 year)
- **Channel Access**: Verifies bot has access to requested channels
- **Content Filtering**: Applies same filtering rules as automatic processing

## 🧠 AI Processing Features

### F004: Content Summarization

**Overview**: Extract key insights, decisions, and action items from raw conversation content.

#### Processing Capabilities

**Summary Generation**:
- **Key Points**: Bullet-pointed list of main discussion points
- **Decisions Made**: Explicit decisions with reasoning and participants
- **Action Items**: Tasks assigned with owners and deadlines (if mentioned)
- **Context Preservation**: Maintains conversation flow and participant roles

**Content Analysis**:
- **Sentiment Analysis**: Identifies tone and urgency of discussions
- **Participant Roles**: Identifies decision makers, contributors, and observers
- **Timeline Extraction**: Chronological ordering of events and decisions
- **Risk Identification**: Flags potential risks or concerns mentioned

#### Business Rules

**Quality Thresholds**:
- **Minimum Content**: Requires at least 50 words for meaningful summarization
- **Confidence Scoring**: AI assigns confidence scores to extracted information
- **Human Review**: Low-confidence summaries are flagged for human review
- **Language Support**: Primarily English, with basic support for other languages

**Content Filtering**:
- **PII Removal**: Automatically removes or masks personal information
- **Sensitive Content**: Flags content that might contain sensitive information
- **Code Snippets**: Preserves and properly formats code blocks
- **URLs and References**: Maintains links and external references

#### Edge Cases

**Incomplete Conversations**:
- **Missing Context**: Requests additional context when conversation seems incomplete
- **Fragmented Discussions**: Attempts to piece together related discussions
- **Multi-Channel Discussions**: Identifies when discussions span multiple channels

**Ambiguous Content**:
- **Unclear Decisions**: Flags unclear or contradictory decisions
- **Missing Participants**: Notes when key participants seem to be missing
- **Technical Jargon**: Handles domain-specific terminology appropriately

### F005: Content Classification

**Overview**: Automatically categorize content into predefined topics for organization.

#### Topic Categories

**Primary Categories**:
- `product-planning`: Product roadmap, feature planning, requirements
- `technical-architecture`: System design, architecture decisions, technical debt  
- `bug-reports`: Bug discussions, troubleshooting, fixes
- `feature-requests`: New feature discussions, enhancement requests
- `team-decisions`: Team processes, policies, organizational decisions
- `project-updates`: Status updates, milestone reports, progress reviews
- `security`: Security discussions, vulnerability reports, compliance
- `performance`: Performance analysis, optimization discussions
- `user-feedback`: Customer feedback, user research, support issues
- `general-discussion`: Miscellaneous discussions not fitting other categories

#### Classification Logic

**Multi-label Classification**:
- **Primary Topic**: Main category with highest confidence score
- **Secondary Topics**: Additional relevant categories (up to 2)
- **Confidence Scores**: Numeric confidence for each assigned category
- **Custom Categories**: Support for organization-specific topic categories

**Classification Rules**:
- **Keyword Matching**: Uses keyword dictionaries for each category
- **Context Analysis**: Considers conversation context and participants
- **Source Weighting**: Jira issues weighted differently than Slack messages
- **Historical Learning**: Improves classification based on human feedback

#### Business Rules

**Classification Thresholds**:
- **Minimum Confidence**: 70% confidence required for automatic classification
- **Manual Review**: Sub-threshold classifications flagged for human review
- **Reclassification**: Supports manual reclassification with feedback loop
- **Category Evolution**: Periodic review of classification accuracy

**Fallback Handling**:
- **Unclassifiable Content**: Defaults to `general-discussion` with low confidence
- **Multiple High Scores**: Selects primary based on context and source type
- **Category Conflicts**: Resolves conflicts using predefined priority rules

### Smart Deduplication
- Merge related conversations across channels/time
- Avoid content repetition while preserving context
- Link related discussions and reference previous decisions

## Document Generation Features

### F006: Markdown Documentation

**Overview**: Generate structured, consistent markdown documentation from processed content.

#### Document Structure

**Standard Template**:
```markdown
# Topic: [Auto-generated title]
## Context
- **Participants**: @user1, @user2  
- **Date**: 2024-01-15
- **Source**: #channel-name, PROJ-123

## Summary
[AI-generated summary]

## Key Decisions
- Decision 1: rationale and context
- Decision 2: alternatives considered

## Action Items
- [ ] Task 1 (@owner, due: date)
- [ ] Task 2 (@owner, due: date)

## Code References
[Embedded code snippets with links]
```

**Content Formatting**:
- **Code Blocks**: Proper syntax highlighting for code snippets
- **Links**: Preserved external links and references
- **Lists**: Structured bullet points and numbered lists
- **Tables**: Formatted tables for structured data
- **Emphasis**: Bold and italic formatting for key points

#### Business Rules

**Document Naming**:
- **Convention**: `[topic]-[date]-[brief-description].md`
- **Uniqueness**: Ensures unique filenames within repository
- **Path Structure**: Organizes by topic in subdirectories
- **Special Characters**: Sanitizes filenames for cross-platform compatibility

**Content Organization**:
- **Topic Grouping**: Related content merged into existing documents
- **Chronological Order**: Within documents, maintains chronological flow
- **Cross-References**: Links to related documents and discussions
- **Version History**: Tracks changes and updates over time

### F007: Content Merging & Deduplication

**Overview**: Intelligently merge new information with existing documents to avoid duplication.

#### Merging Strategies

**Document Matching**:
- **Topic Similarity**: Groups content by topic classification
- **Participant Overlap**: Considers common participants in discussions
- **Time Windows**: Merges content within configurable time windows
- **Keyword Matching**: Uses content keywords for similarity matching

**Merge Algorithms**:
- **Append Mode**: Adds new content to existing documents chronologically
- **Integration Mode**: Weaves new content into existing structure
- **Summary Mode**: Updates summaries with new information
- **Reference Mode**: Adds cross-references without duplicating content

#### Business Rules

**Merge Criteria**:
- **Similarity Threshold**: 80% topic similarity for automatic merging
- **Time Proximity**: Content within 7 days considered for merging
- **Participant Overlap**: >50% participant overlap suggests related discussions
- **Manual Override**: Users can force separate documents

**Conflict Resolution**:
- **Contradictory Information**: Highlights conflicts for human review
- **Version Precedence**: Latest information takes precedence unless flagged
- **Source Authority**: Weights different sources differently (Jira > Slack)
- **Human Review**: Complex merges flagged for manual review

## 🔗 Code Integration Features (Phase 1)

### F008: GitHub Link Detection & Parsing

**Overview**: Automatically detect and parse GitHub code references in various formats.

#### Supported Link Formats

**Single Line References**:
- Format: `https://github.com/owner/repo/blob/main/file.ts#L15`
- Example: `[getUserById function](https://github.com/owner/repo/blob/main/file.ts#L15)`
- Behavior: Extracts specific line of code

**Line Range References**:
- Format: `https://github.com/owner/repo/blob/main/file.ts#L15-L20`
- Example: `[validation logic](https://github.com/owner/repo/blob/main/file.ts#L15-L20)`
- Behavior: Extracts range of lines with context

**Function References**:
- Format: `github://owner/repo/file.ts#functionName`
- Example: `[authentication handler](github://myorg/api/src/auth.ts#validateToken)`
- Behavior: Extracts entire function definition

**Class Method References**:
- Format: `github://owner/repo/path/file.ts#ClassName.methodName`
- Example: `[user service method](github://myorg/api/src/user.service.ts#UserService.findById)`
- Behavior: Extracts specific class method

#### Parsing Logic

**URL Validation**:
- **Repository Access**: Verifies bot has access to repository
- **File Existence**: Checks if referenced file exists
- **Path Validation**: Ensures file path is valid and accessible
- **Branch Handling**: Defaults to default branch unless specified

**Content Extraction**:
- **Line Numbers**: Validates line numbers exist in file
- **Function Detection**: Uses language-specific parsing for function boundaries
- **Context Inclusion**: Includes surrounding context for better understanding
- **Error Handling**: Graceful fallback when exact references can't be found

#### Business Rules

**Repository Permissions**:
- **Private Repos**: Requires GitHub token with appropriate permissions
- **Organization Repos**: Respects organization access policies
- **Public Repos**: Can access without authentication
- **Rate Limiting**: Respects GitHub API rate limits

**Content Processing**:
- **File Size Limits**: Files larger than 1MB are not processed
- **Language Support**: Supports most common programming languages
- **Binary Files**: Skips binary files and images
- **Generated Code**: Flags auto-generated code when possible

### F009: Code Snippet Embedding

**Overview**: Replace GitHub links with actual code snippets embedded in documentation.

#### Embedding Process

**Code Extraction**:
1. **Parse Link**: Extract repository, file path, and reference details
2. **Fetch Content**: Retrieve file content from GitHub API
3. **Extract Snippet**: Extract specific lines, ranges, or functions
4. **Format Code**: Apply proper syntax highlighting and formatting
5. **Update Document**: Replace link with embedded code block

**Code Block Format**:
```markdown
**[Original Link Text](https://github.com/owner/repo/blob/main/file.ts#L15)**
```typescript
// File: src/services/user.service.ts (line 15)
export function getUserById(id: string): Promise<User> {
  return this.userRepository.findById(id);
}
```
*Last updated: 2024-01-15 14:30 UTC*
```

#### Business Rules

**Code Freshness**:
- **Hash Tracking**: Stores content hash to detect changes
- **Update Frequency**: Checks for updates daily for active references
- **Staleness Warnings**: Flags code that hasn't been updated in 30+ days
- **Manual Refresh**: Provides API to force refresh specific references

**Display Rules**:
- **Context Lines**: Includes 2-3 lines of context around specific lines
- **Function Boundaries**: For function references, includes complete function
- **Large Snippets**: Truncates very large code blocks with expand option
- **Syntax Highlighting**: Applies appropriate language highlighting

### F010: Code Change Tracking

**Overview**: Monitor referenced code for changes and notify when documentation needs updates.

#### Change Detection

**Content Monitoring**:
- **SHA Comparison**: Compares file SHAs to detect changes
- **Content Hashing**: Uses content-based hashing for specific snippets
- **Line Movement**: Detects when code moves within files
- **Function Renames**: Identifies function name changes

**Notification Triggers**:
- **Direct Changes**: Referenced lines are modified
- **Nearby Changes**: Changes within 5 lines of reference
- **Function Changes**: Function signature or name changes
- **File Moves**: Referenced file is moved or renamed

#### Business Rules

**Change Sensitivity**:
- **Whitespace Changes**: Ignores pure whitespace/formatting changes
- **Comment Changes**: Optionally ignores comment-only changes
- **Version Tags**: Considers semantic version tags for major changes
- **Branch Tracking**: Tracks changes on specified branches only

**Update Strategies**:
- **Automatic Updates**: Minor changes updated automatically
- **Manual Review**: Major changes flagged for human review
- **Deprecation Handling**: Flags references to deprecated code
- **Batch Updates**: Groups related changes for efficient processing

## 🔄 GitHub Integration Features

### F011: Repository Management

**Overview**: Manage documentation files and repository operations through GitHub API.

#### File Operations

**Document Creation**:
- **Path Generation**: Creates organized directory structure by topic
- **Naming Conventions**: Consistent file naming across documents
- **Content Formatting**: Proper markdown formatting and metadata
- **Conflict Resolution**: Handles naming conflicts and duplicate files

**Document Updates**:
- **Version Control**: Maintains proper git history for changes
- **Merge Strategies**: Intelligent merging of document updates
- **Backup Creation**: Creates backups before significant changes
- **Rollback Support**: Ability to revert problematic changes

#### Business Rules

**Repository Structure**:
- **Organization**: Documents organized by topic in subdirectories
- **Naming Convention**: Consistent, descriptive file names
- **Index Files**: Automatic generation of index/README files
- **Archive Handling**: Old documents archived rather than deleted

**Access Control**:
- **Token Permissions**: Uses fine-grained personal access tokens
- **Repository Selection**: Configurable target repositories
- **Branch Strategy**: Typically targets main/master branch
- **Backup Strategy**: Regular backups of important documents

### F012: Pull Request Workflow

**Overview**: Create and manage pull requests for all documentation changes with team review.

#### PR Creation Process

**Automated PR Generation**:
1. **Branch Creation**: Creates feature branch for each document update
2. **Content Staging**: Stages all related file changes
3. **Commit Creation**: Creates descriptive commit messages
4. **PR Creation**: Opens pull request with detailed description
5. **Reviewer Assignment**: Assigns appropriate team members as reviewers

**PR Description Template**:
```markdown
## Knowledge AI Document Update

### Summary
AI-generated documentation from recent team discussions.

### Source Content
- **Slack**: [Channel link] (Date range)
- **Jira**: [Issue links]
- **Participants**: @user1, @user2, @user3

### Changes
- ✅ New document: [filename]
- ✅ Updated document: [filename]
- ✅ Code references updated: [count]

### AI Confidence
- **Summarization**: 94%
- **Classification**: 87%
- **Action Items**: 76% (review recommended)

### Review Notes
[Any specific items requiring human attention]

/cc @team-lead @tech-writer
```

#### Business Rules

**Reviewer Assignment**:
- **Default Reviewers**: Configurable list of default reviewers
- **Topic-Based Assignment**: Different reviewers for different topics
- **Participant Inclusion**: Includes discussion participants as reviewers
- **Workload Balancing**: Rotates reviewer assignments to balance workload

**PR Management**:
- **Auto-merge Rules**: Conditions for automatic merging (if enabled)
- **Review Requirements**: Minimum number of approvals required
- **Conflict Resolution**: Handles merge conflicts gracefully
- **Status Tracking**: Tracks PR status and follow-up actions

### F013: Team Collaboration

**Overview**: Support team review, editing, and improvement of generated documentation.

#### Collaborative Features

**Review Process**:
- **Inline Comments**: Support for line-by-line feedback
- **Suggestion Mode**: Reviewers can suggest specific changes
- **Approval Workflow**: Structured approval process
- **Change Requests**: Clear process for requesting modifications

**Editorial Support**:
- **Manual Editing**: Teams can edit documents directly
- **Version History**: Maintains history of all changes
- **Conflict Resolution**: Handles simultaneous edits gracefully
- **Quality Metrics**: Tracks document quality and engagement

#### Business Rules

**Review Requirements**:
- **Minimum Reviews**: Configurable minimum reviewer count
- **Domain Expertise**: Route to appropriate domain experts
- **Blocking Issues**: Clear escalation path for problems
- **Time Limits**: Configurable review timeouts with auto-merge options

**Quality Assurance**:
- **Content Guidelines**: Enforces documentation standards  
- **Style Consistency**: Maintains consistent formatting and style
- **Accuracy Verification**: Process for verifying technical accuracy
- **Feedback Loop**: Incorporates review feedback into AI improvement

---

*These features work together to provide a comprehensive knowledge management solution that captures, processes, and organizes team knowledge automatically while maintaining quality through human oversight.* 

## Business Rules

### Content Processing Rules
1. **Priority Queue**: Process reactions immediately, bulk imports in background
2. **Rate Limiting**: Respect API limits (Slack: 1 req/sec, GitHub: 5000/hour)
3. **Error Handling**: Retry failures 3x with exponential backoff
4. **Data Retention**: Keep processed messages for 2 years, raw data for 6 months

### Code Tracking Rules
1. **Reference Validation**: Verify links are accessible before embedding
2. **Change Detection**: Check referenced files daily for modifications  
3. **Stale Handling**: Flag outdated references, suggest updates
4. **Access Control**: Respect private repository permissions

### Document Management Rules
1. **Merge Strategy**: Combine related content, avoid duplication
2. **Version Control**: Track all changes through Git history
3. **Conflict Resolution**: Human review required for merge conflicts
4. **Quality Gates**: Minimum content length, required sections

## Edge Cases & Error Handling

### Data Collection
- **Missing Permissions**: Graceful degradation, log access issues
- **Rate Limits**: Queue requests, implement backoff strategies
- **Invalid Content**: Skip malformed messages, log for investigation
- **Network Failures**: Retry with exponential backoff, alert on persistent failures

### AI Processing
- **LLM Failures**: Fallback to basic extraction, queue for retry
- **Content Too Large**: Chunk processing, maintain context
- **Low Quality Output**: Flag for human review, improve prompts
- **Provider Switching**: Seamless fallback between OpenAI/Ollama

### GitHub Integration
- **PR Creation Failures**: Log errors, manual intervention required
- **Repository Access**: Validate permissions, clear error messages
- **Branch Conflicts**: Generate unique branch names, handle collisions
- **Code Reference Failures**: Mark as unavailable, suggest alternatives 
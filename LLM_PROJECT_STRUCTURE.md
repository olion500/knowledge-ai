# LLM Project Structure Guide

## 🎯 Core System Overview

**Purpose**: AI-powered knowledge management system that collects Slack/Jira data → processes with LLM → generates GitHub documentation

**Data Flow**: `Slack/Jira Events` → `Message Processing` → `LLM Analysis` → `Document Generation` → `GitHub PR`

**Tech Stack**: NestJS + TypeScript + PostgreSQL + Redis + Bull Queue + OpenAI/Ollama

## 🏗️ Module Architecture

```
src/
├── app.module.ts           # Root module with all imports
├── main.ts                 # Application bootstrap
├── modules/                # Feature modules
│   ├── slack/              # Slack integration & webhooks
│   ├── jira/               # Jira integration & webhooks
│   ├── llm/                # LLM processing (OpenAI/Ollama)
│   ├── github/             # GitHub API & PR creation
│   ├── document/           # Document orchestration
│   ├── code-tracking/      # Code tracking & linking (Phase 1)
│   └── database/           # Database operations
├── common/                 # Shared components
│   ├── entities/           # TypeORM entities
│   ├── interfaces/         # TypeScript interfaces
│   ├── dto/                # Data Transfer Objects
│   ├── decorators/         # Custom decorators
│   ├── guards/             # Auth/validation guards
│   └── filters/            # Exception filters
└── config/                 # Configuration files
```

## 📊 Core Data Models

### Entities (PostgreSQL)

**Message Entity** (`src/common/entities/message.entity.ts`)
```typescript
- id: UUID (PK)
- source: 'slack' | 'jira'
- sourceId: string (unique per source)
- channel: string
- user: string
- content: text
- metadata: jsonb
- sourceTimestamp: timestamp
- processed: boolean
- topic: string
- tags: string[]
- summary: text
- documentId: UUID (FK)
```

**Document Entity** (`src/common/entities/document.entity.ts`)
```typescript
- id: UUID (PK)
- title: string
- topic: string
- content: text
- filePath: string
- tags: string[]
- participants: string[]
- metadata: jsonb
- githubPrUrl: string
- githubCommitSha: string
- published: boolean
- lastSyncedAt: timestamp
```

**CodeReference Entity** (`src/common/entities/code-reference.entity.ts`)
```typescript
- id: UUID (PK)
- repositoryOwner: string
- repositoryName: string
- filePath: string
- referenceType: 'line' | 'range' | 'function'
- startLine?: number
- endLine?: number
- functionName?: string
- content: text
- contentHash: string
- lastFetchedAt: timestamp
- isActive: boolean
```

**DocumentCodeLink Entity** (`src/common/entities/document-code-link.entity.ts`)
```typescript
- id: UUID (PK)
- documentId: UUID (FK)
- codeReferenceId: UUID (FK)
- placeholderText: string
- context?: string
- isActive: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

### Key Interfaces

**LLM Interfaces** (`src/common/interfaces/llm.interface.ts`)
- `LLMRequest`: Input for LLM processing
- `SummaryResponse`: Extracted summary, key points, decisions, action items
- `ClassificationResponse`: Topic classification with confidence
- `DocumentGenerationRequest/Response`: Document creation payload

**Code Reference Interfaces** (`src/common/interfaces/code-reference.interface.ts`)
- `CodeLinkInfo`: Parsed GitHub link information
- `CodeReferenceValidation`: Code reference validation structure
- `LineBasedCodeResult`: Line-based code extraction result
- `FunctionBasedCodeResult`: Function-based code extraction result
- `ReferenceType`: Code reference type union ('line' | 'range' | 'function')
- `GitHubInfo`: GitHub repository and file information

## 🔧 Module Details

### 1. Slack Module (`src/modules/slack/`)
**Purpose**: Handle Slack webhooks and message collection
**Key Components**:
- `SlackController`: Webhook endpoints (`/slack/events`, `/slack/collect`)
- `SlackService`: Slack API interactions, message filtering
- **Triggers**: Reactions (📝,📋,🔖) or keywords ("decision", "action item")
- **Output**: Creates `Message` entities

### 2. Jira Module (`src/modules/jira/`)
**Purpose**: Handle Jira webhooks and issue processing
**Key Components**:
- `JiraController`: Webhook endpoint (`/jira/webhook`)
- `JiraService`: Jira API interactions, issue processing
- **Triggers**: Issue created/updated/commented
- **Output**: Creates `Message` entities

### 3. LLM Module (`src/modules/llm/`)
**Purpose**: Process messages with AI (summarization + classification)
**Key Components**:
- `LLMService`: Main orchestrator
- `OpenAIProvider`: OpenAI integration
- `OllamaProvider`: Local Ollama integration
- **Input**: Raw message content
- **Output**: `SummaryResponse` + `ClassificationResponse`

### 4. GitHub Module (`src/modules/github/`)
**Purpose**: Create/update documentation in GitHub
**Key Components**:
- `GitHubService`: Repository operations, PR creation
- **Input**: Generated document content
- **Output**: GitHub PR with markdown files

### 5. Document Module (`src/modules/document/`)
**Purpose**: Orchestrate the entire processing pipeline
**Key Components**:
- `DocumentService`: Main orchestrator
- **Process**: Message → LLM → Document → GitHub PR

### 6. Code Tracking Module (`src/modules/code-tracking/`) - Phase 1
**Purpose**: Parse GitHub links and embed code snippets in documents
**Key Components**:
- `CodeTrackingController`: REST API endpoints for code tracking
- `CodeTrackingService`: Main orchestrator for code tracking pipeline
- `CodeParserService`: Parse GitHub links from document content
- `CodeExtractorService`: Extract code from GitHub repositories
- **Input**: Documents with GitHub links (`github://owner/repo/file.ts:line` format)
- **Output**: Documents with embedded code snippets and tracking metadata

## 🔄 Processing Pipeline

```
1. Event Trigger (Slack/Jira)
   ↓
2. Message Entity Creation
   ↓
3. LLM Processing (async queue)
   ├── Summarization
   └── Classification
   ↓
4. Document Generation
   ├── Check existing documents
   ├── Merge or create new
   └── Update Document entity
   ↓
5. GitHub Integration
   ├── Create/update markdown file
   ├── Create PR
   └── Assign reviewers
```

## ⚙️ Configuration System

**Environment Variables** (see `env.template`):
- **Database**: PostgreSQL connection
- **Redis**: Queue management
- **Slack**: Bot token, signing secret
- **Jira**: Host, credentials
- **GitHub**: Token, repository info
- **LLM**: Provider (openai/ollama), model settings

**Topic Classification** (predefined):
```typescript
const TOPICS = [
  'product-planning',
  'technical-architecture', 
  'bug-reports',
  'feature-requests',
  'team-decisions',
  'project-updates',
  'security',
  'performance',
  'user-feedback',
  'general-discussion'
];
```

## 🚀 Adding New Features

### Adding New Data Source
1. Create module in `src/modules/[source]/`
2. Create controller with webhook endpoint
3. Create service for API integration
4. Add message creation logic
5. Update `app.module.ts` imports

### Adding New LLM Provider
1. Create provider class implementing `LLMProvider` interface
2. Add to `LLMService` provider factory
3. Add configuration in `env.template`
4. Update documentation

### Adding New Document Type
1. Add topic to classification list
2. Update document templates
3. Add specific processing logic in `DocumentService`

## 🛠️ Development Patterns

**Dependency Injection**: All services use NestJS DI
**Error Handling**: Global exception filters
**Validation**: Class-validator for DTOs
**Async Processing**: Bull queues for LLM operations
**Database**: TypeORM with migrations
**Testing**: Jest with comprehensive unit/e2e tests

## 📡 API Endpoints

**Webhooks**:
- `POST /slack/events` - Slack event subscriptions
- `POST /jira/webhook` - Jira issue webhooks

**Manual Operations**:
- `POST /slack/collect` - Manual message collection
- `GET /health` - Health check

**Code Tracking APIs** (Phase 1):
- `POST /code-tracking/process-document` - Process GitHub links in documents
- `POST /code-tracking/update-document-snippets` - Replace links with code snippets  
- `GET /code-tracking/document/:id/references` - Get document's code references
- `GET /code-tracking/references/active` - Get all active code references
- `POST /code-tracking/references/:id/deactivate` - Deactivate code reference

## 🔍 Key Files for New Features

**Common Patterns**:
- Add entity: `src/common/entities/`
- Add interface: `src/common/interfaces/`
- Add DTO: `src/common/dto/`
- Add service: `src/modules/[module]/[module].service.ts`
- Add controller: `src/modules/[module]/[module].controller.ts`
- Add module: `src/modules/[module]/[module].module.ts`
- Update app: `src/app.module.ts`

**Testing**:
- Unit tests: `*.spec.ts` files
- E2E tests: `test/` directory
- Test DB: `docker-compose.test.yml`

## 💡 LLM Integration Points

**Where to Modify LLM Behavior**:
1. **Prompts**: `src/modules/llm/prompts/` (if exists) or inline in services
2. **Response Processing**: `src/modules/llm/llm.service.ts`
3. **Provider Switching**: Environment variable `LLM_PROVIDER`
4. **Model Configuration**: `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`, model-specific settings

**Adding Custom AI Processing**:
1. Create new method in `LLMService`
2. Define request/response interfaces
3. Add to document generation pipeline
4. Update tests

This structure enables rapid feature development while maintaining clear separation of concerns and scalability.

## ✅ Mandatory Development Checklist

### 🔴 Required Tasks for Feature Addition/Modification

**⚠️ Critical**: Complete the following tasks after every feature change.

#### 1. Test Code Writing/Modification
```bash
# For new feature additions
- [ ] Write unit tests for the service (*.spec.ts)
- [ ] Write controller tests for new API endpoints
- [ ] Add E2E tests (when necessary)

# For existing feature modifications
- [ ] Update affected test code
- [ ] Update mock data

# Test execution and validation
- [ ] Unit tests pass: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e:full`
- [ ] Coverage check: `pnpm test:cov` (maintain 80%+)
```

#### 2. Documentation Writing/Updates
```bash
# For new module/service additions
- [ ] Update LLM_PROJECT_STRUCTURE.md
- [ ] Generate API documentation (when needed)
- [ ] Update env.template when adding configuration variables

# For existing feature modifications
- [ ] Update related documentation content
- [ ] Update README.md (when usage changes)

# Documentation validation
- [ ] Check markdown syntax
- [ ] Verify code examples work
- [ ] Validate link integrity
```

#### 3. Code Quality Verification
```bash
# Code style and linting
- [ ] ESLint passes: `pnpm lint`
- [ ] Apply Prettier formatting: `pnpm format`
- [ ] TypeScript compilation check: `pnpm build`

# Dependencies and security
- [ ] Clean up package.json when adding new packages
- [ ] Verify environment variable security
```

### 🚨 Completion Criteria

**All feature changes must satisfy the following conditions:**

1. **✅ 100% Test Pass Rate**
   - Existing tests are not broken
   - Test coverage secured for new features

2. **📝 Documentation Complete**
   - Changes reflected in documentation
   - New feature usage clearly documented

3. **🔧 Build Success**
   - No TypeScript compilation errors
   - Lint rules compliance

### 📋 Checklist Template

**Copy and use when adding new features:**

```markdown
## [Feature Name] Development Completion Checklist

### Testing
- [ ] Write unit tests: `src/modules/[module]/[service].spec.ts`
- [ ] Write controller tests: `src/modules/[module]/[controller].spec.ts`
- [ ] Add E2E tests: `test/[feature].e2e-spec.ts`
- [ ] All tests pass: `pnpm test`
- [ ] E2E tests pass: `pnpm test:e2e:full`

### Documentation
- [ ] Update LLM_PROJECT_STRUCTURE.md
- [ ] Add usage to README.md
- [ ] Update env.template (when adding config)
- [ ] Write API documentation (if needed)

### Code Quality
- [ ] `pnpm lint` passes
- [ ] `pnpm format` applied
- [ ] `pnpm build` succeeds
- [ ] Type safety verified

### Final Verification
- [ ] Full functionality verified in local environment
- [ ] Development environment (`make dev`) works properly
- [ ] Documentation review completed
```

### 🔄 Automation Scripts

**Execute full validation at once:**

```bash
# Run all validations
pnpm run validate

# Or execute individually
pnpm lint && pnpm format && pnpm build && pnpm test && pnpm test:e2e:full
```

Following this checklist ensures code quality and project consistency are maintained.

## 🎯 Code Tracking Feature (Phase 1) - Completed

### Supported GitHub Link Formats

The system now automatically recognizes and processes these GitHub link formats in documents:

```markdown
[코드 예시](github://owner/repo/src/file.ts:15)           # Single line
[코드 범위](github://owner/repo/src/file.ts:15-20)        # Line range  
[함수 설명](github://owner/repo/src/file.ts#functionName)  # Function
[클래스 메서드](github://owner/repo/src/file.ts#Class.method) # Class method
```

### Phase 1 Implementation Status

✅ **Completed Components**:
- `CodeReference` and `DocumentCodeLink` entities with full validation
- `CodeParserService` for parsing various GitHub link formats
- `CodeExtractorService` for extracting code via GitHub API
- `CodeTrackingService` for orchestrating the pipeline
- `CodeTrackingController` with REST API endpoints
- Comprehensive test coverage (52 tests across 5 test suites)
- Integration with existing NestJS application

✅ **Key Features**:
- Automatic GitHub link detection and parsing
- Line number and function name-based code extraction
- Code snippet caching with hash verification
- Document update with embedded code snippets
- Error handling for missing files/functions
- Content change detection through hashing

### Future Development

For detailed development plans and upcoming features, see **[LLM_ROADMAP.md](LLM_ROADMAP.md)**.
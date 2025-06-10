# Project Structure

## System Architecture

```
NestJS App
├── Webhooks (Slack/Jira) → Events
├── Queue System (Redis/Bull) → Async Processing  
├── LLM Service → Content Processing
├── GitHub Service → PR Creation
└── Database (PostgreSQL) → Persistence
```

## Module Structure

```
src/
├── main.ts                 # App bootstrap
├── app.module.ts          # Root module
├── modules/
│   ├── slack/             # Slack integration
│   ├── jira/              # Jira integration  
│   ├── llm/               # AI processing
│   ├── github/            # GitHub automation
│   ├── document/          # Document generation
│   ├── code-tracking/     # Code reference tracking
│   └── common/            # Shared utilities
└── shared/
    ├── entities/          # Database models
    ├── dto/               # Data transfer objects
    ├── services/          # Shared services
    └── types/             # Type definitions
```

## Core Data Models

### Message Entity
```typescript
@Entity()
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  source: 'slack' | 'jira';

  @Column()
  externalId: string;

  @Column('text')
  content: string;

  @Column('jsonb')
  metadata: Record<string, any>;

  @Column()
  processed: boolean = false;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Document Entity
```typescript
@Entity()
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column()
  status: 'draft' | 'review' | 'published';

  @OneToMany(() => CodeReference, ref => ref.document)
  codeReferences: CodeReference[];

  @Column()
  githubPrUrl?: string;
}
```

### CodeReference Entity
```typescript
@Entity()
export class CodeReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  githubUrl: string;

  @Column()
  filePath: string;

  @Column('int')
  startLine?: number;

  @Column('int')
  endLine?: number;

  @Column('text')
  codeSnippet: string;

  @Column()
  lastCommitSha: string;
}
```

## Service Architecture

### Event-Driven Pattern
```typescript
// Webhook Controller → Service → Queue
@Controller('webhooks')
export class WebhookController {
  @Post('slack')
  async handleSlack(@Body() payload: SlackEvent) {
    await this.queueService.add('process-message', payload);
  }
}

// Queue Consumer → LLM → Document
@Processor('message-processing')
export class MessageProcessor {
  @Process('process-message')
  async handle(job: Job<MessageData>) {
    const processed = await this.llmService.analyze(job.data);
    await this.documentService.generate(processed);
  }
}
```

## Key Design Patterns

### Dependency Injection
```typescript
@Injectable()
export class DocumentService {
  constructor(
    private llmService: LLMService,
    private githubService: GitHubService,
    private documentRepo: Repository<Document>
  ) {}
}
```

### Strategy Pattern (LLM Providers)
```typescript
interface LLMProvider {
  process(content: string): Promise<ProcessedContent>;
}

@Injectable()
export class LLMService {
  constructor(
    @Inject('LLM_PROVIDER') private provider: LLMProvider
  ) {}
}
```

### Repository Pattern
```typescript
@Injectable()
export class DocumentRepository {
  async findByStatus(status: DocumentStatus): Promise<Document[]> {
    return this.repo.find({ where: { status } });
  }
}
```

## Testing Structure

```
test/
├── unit/              # Service unit tests
├── integration/       # Module integration tests  
└── e2e/              # End-to-end API tests
```

**Test Patterns:**
- Mock external APIs (Slack, GitHub, OpenAI)
- Use in-memory database for integration tests
- 85%+ code coverage requirement

---

*This architecture provides a solid foundation for scalable, maintainable knowledge management while supporting rapid feature development.* 
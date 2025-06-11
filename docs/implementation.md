# Implementation

## Development Philosophy

**Principles**: TypeScript-first, test-driven development, modular architecture  
**Quality Standards**: 85%+ test coverage, ESLint compliance, comprehensive documentation  
**Error Handling**: Graceful degradation, structured logging, monitoring

## Code Structure Patterns

### Module Pattern
```typescript
// modules/[feature]/[feature].module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureRepository],
  exports: [FeatureService],
})
export class FeatureModule {}
```

### Service Pattern
```typescript
@Injectable()
export class FeatureService {
  constructor(
    private repo: Repository<Entity>,
    private logger: Logger,
  ) {}

  async process(data: CreateDto): Promise<ResultDto> {
    try {
      const result = await this.repo.save(data);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Process failed', error);
      throw new InternalServerErrorException('Processing failed');
    }
  }
}
```

### Error Handling Pattern
```typescript
// Custom Result type for error handling
type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Usage in services
async function processMessage(msg: Message): Promise<Result<Document>> {
  try {
    const doc = await this.generateDocument(msg);
    return { success: true, data: doc };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('DocumentService', () => {
  let service: DocumentService;
  let mockRepo: jest.Mocked<Repository<Document>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: getRepositoryToken(Document), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  it('should create document', async () => {
    const result = await service.create(mockData);
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests
```typescript
describe('Message Processing (Integration)', () => {
  beforeEach(async () => {
    // Use test database
    app = await Test.createTestingModule({
      imports: [TestDatabaseModule],
    }).compile();
  });

  it('should process slack message end-to-end', async () => {
    const message = await createTestMessage();
    const result = await service.processMessage(message);
    expect(result.document).toBeDefined();
  });
});
```

### E2E Tests
```typescript
describe('API Endpoints (E2E)', () => {
  it('POST /webhooks/slack', () => {
    return request(app.getHttpServer())
      .post('/webhooks/slack')
      .send(mockSlackPayload)
      .expect(200)
      .expect(res => {
        expect(res.body.processed).toBe(true);
      });
  });
});
```

## Security Guidelines

### Input Validation
```typescript
// DTO with validation
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(['slack', 'jira'])
  source: 'slack' | 'jira';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
```

### Authentication Guard
```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    return this.validateApiKey(apiKey);
  }
}
```

## Performance Optimization

### Database Queries
```typescript
// Use indexes and optimized queries
@Entity()
export class Message {
  @Index()
  @Column()
  source: string;

  @Index(['processed', 'createdAt'])
  @Column()
  processed: boolean;
}

// Repository with optimized queries
async findUnprocessed(): Promise<Message[]> {
  return this.repo.find({
    where: { processed: false },
    order: { createdAt: 'ASC' },
    take: 100, // Batch processing
  });
}
```

### Caching Strategy
```typescript
@Injectable()
export class CacheService {
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

### Queue Processing
```typescript
@Processor('message-processing')
export class MessageProcessor {
  @Process('analyze-content')
  async handleAnalysis(job: Job<MessageData>) {
    const { data } = job;
    
    // Process with retry logic
    const result = await this.processWithRetry(data);
    
    // Update progress
    job.progress(100);
    
    return result;
  }

  private async processWithRetry(data: MessageData, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.llmService.analyze(data);
      } catch (error) {
        if (i === attempts - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }
}
```

## Deployment Procedures

### Docker Build
```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Environment Management
```typescript
// Configuration validation
@Injectable()
export class ConfigService {
  constructor() {
    this.validateConfig();
  }

  private validateConfig() {
    const required = ['DATABASE_URL', 'REDIS_URL', 'LLM_PROVIDER'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }
  }
}
```

### Health Monitoring
```typescript
@Controller('health')
export class HealthController {
  constructor(
    private db: DataSource,
    private redis: Redis,
    private llmService: LLMService,
  ) {}

  @Get('status')
  async getStatus() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(), 
      this.checkLLM(),
    ]);

    return {
      status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'unhealthy',
      checks: checks.map((check, i) => ({
        name: ['database', 'redis', 'llm'][i],
        status: check.status === 'fulfilled' ? 'up' : 'down',
      })),
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Code Quality Standards

### ESLint Configuration
```json
{
  "extends": ["@nestjs", "@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "complexity": ["error", 10],
    "max-lines-per-function": ["error", 50]
  }
}
```

### Commit Standards
```
feat: add slack message processing
fix: resolve database connection issue  
docs: update API documentation
test: add integration tests for LLM service
refactor: improve error handling patterns
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:e2e
      - run: npm run build
``` 

## Smart Code Tracking Patterns

### Webhook Event Processing Pattern
```typescript
@Controller('api/webhooks')
export class WebhookController {
  @Post('github')
  async handleGitHubWebhook(@Headers() headers: any, @Body() payload: any) {
    // 1. Validate webhook signature
    const isValid = this.webhookService.validateSignature(payload, headers);
    if (!isValid) throw new BadRequestException('Invalid signature');

    // 2. Route by event type
    const eventType = headers['x-github-event'];
    switch (eventType) {
      case 'push':
        return this.webhookService.handlePushEvent(payload);
      case 'pull_request':
        return this.webhookService.handlePullRequestEvent(payload);
      default:
        return { status: 'ignored', event: eventType };
    }
  }
}
```

### Enhanced Entity Pattern with Smart Tracking
```typescript
@Entity('code_references')
export class CodeReference {
  // Phase 1 fields
  @Column() repositoryOwner: string;
  @Column() filePath: string;
  @Column() content: string;

  // Phase 2 smart tracking fields
  @Column({ nullable: true }) commitSha?: string;
  @Column({ nullable: true }) lastModified?: Date;
  @Column({ default: false }) isStale: boolean;
  @Column('text', { array: true, default: '{}' }) dependencies: string[];

  // Smart tracking business methods
  markAsStale(): void { this.isStale = true; }
  markAsFresh(): void { this.isStale = false; }
  
  updateCommitInfo(commitSha: string, lastModified: Date): void {
    this.commitSha = commitSha;
    this.lastModified = lastModified;
    this.markAsFresh();
  }

  addDependency(filePath: string): void {
    if (!this.dependencies.includes(filePath)) {
      this.dependencies.push(filePath);
    }
  }
}
```

### Smart Change Detection Pattern
```typescript
@Injectable()
export class SmartCodeTrackingService {
  async processCodeChange(changeEvent: CodeChangeEvent): Promise<boolean> {
    try {
      // 1. Mark event as processing
      changeEvent.markAsProcessing();
      await this.save(changeEvent);

      // 2. Process each affected reference
      for (const referenceId of changeEvent.affectedReferences) {
        const reference = await this.findReference(referenceId);
        if (reference) {
          await this.processReferenceChange(reference, changeEvent);
        }
      }

      // 3. Mark as completed
      changeEvent.markAsCompleted();
      await this.save(changeEvent);
      
      return true;
    } catch (error) {
      changeEvent.markAsFailed(error.message);
      await this.save(changeEvent);
      throw error;
    }
  }

  private async processReferenceChange(
    reference: CodeReference,
    changeEvent: CodeChangeEvent,
  ): Promise<void> {
    switch (changeEvent.changeType) {
      case ChangeType.DELETED:
        return this.handleDeletedFile(reference);
      case ChangeType.MODIFIED:
        return this.handleModifiedFile(reference, changeEvent);
      case ChangeType.MOVED:
        return this.handleMovedFile(reference, changeEvent);
    }
  }
}
```

### Intelligent Notification Pattern
```typescript
@Injectable()
export class NotificationService {
  async sendSmartNotification(change: CodeChangeEvent): Promise<void> {
    // 1. Classify change severity
    const severity = await this.classifyChangeSeverity(change);
    
    // 2. Determine notification targets
    const targets = await this.getNotificationTargets(change);
    
    // 3. Format context-aware message
    const message = this.formatNotificationMessage(change, severity);
    
    // 4. Send via appropriate channels
    await this.sendToChannels(message, targets, severity);
  }

  private async classifyChangeSeverity(change: CodeChangeEvent): Promise<'low' | 'medium' | 'high'> {
    const factors = {
      affectedReferences: change.affectedReferences.length,
      changeType: change.changeType,
      fileImportance: await this.getFileImportanceScore(change.filePath),
    };

    // Use heuristics to determine severity
    if (factors.changeType === ChangeType.DELETED || factors.affectedReferences > 5) {
      return 'high';
    } else if (factors.affectedReferences > 2 || factors.fileImportance > 0.7) {
      return 'medium';
    }
    return 'low';
  }
}
```

### Testing Patterns for Phase 2

#### Webhook Controller Testing
```typescript
describe('WebhookController - Phase 2', () => {
  it('should handle pull request events', async () => {
    const prPayload = {
      action: 'opened',
      repository: { full_name: 'owner/repo' },
      pull_request: { number: 123 },
    };

    mockWebhookService.handlePullRequestEvent.mockResolvedValue(undefined);
    
    const result = await controller.handleGitHubWebhook(prHeaders, prPayload);
    
    expect(mockWebhookService.handlePullRequestEvent).toHaveBeenCalledWith(prPayload);
    expect(result).toEqual({ status: 'success', event: 'pull_request' });
  });
});
```

#### Entity Business Logic Testing
```typescript
describe('CodeReference - Smart Tracking', () => {
  it('should manage staleness state', () => {
    const reference = new CodeReference();
    
    reference.markAsStale();
    expect(reference.isStale).toBe(true);
    
    reference.markAsFresh();
    expect(reference.isStale).toBe(false);
  });

  it('should update commit info and mark as fresh', () => {
    const reference = new CodeReference();
    reference.isStale = true;
    
    const commitSha = 'abc123';
    const lastModified = new Date();
    
    reference.updateCommitInfo(commitSha, lastModified);
    
    expect(reference.commitSha).toBe(commitSha);
    expect(reference.lastModified).toBe(lastModified);
    expect(reference.isStale).toBe(false);
  });
});
```

#### Integration Testing for Smart Features
```typescript
describe('Smart Code Tracking Integration', () => {
  beforeEach(async () => {
    // Setup test database with CodeReference entities
    await testDb.setUp();
  });

  it('should process webhook event end-to-end', async () => {
    // 1. Setup test data
    const codeReference = await createTestCodeReference();
    
    // 2. Simulate webhook event
    const pushPayload = createPushEventPayload({
      modifiedFiles: [codeReference.filePath],
    });
    
    // 3. Process webhook
    await webhookController.handleGitHubWebhook(headers, pushPayload);
    
    // 4. Verify smart tracking
    const updatedReference = await codeReferenceRepo.findOne(codeReference.id);
    expect(updatedReference.isStale).toBe(true);
    
    // 5. Verify notification sent
    expect(mockNotificationService.sendSmartNotification).toHaveBeenCalled();
  });
});
```
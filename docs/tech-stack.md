# Tech Stack

## Core Architecture

**Backend**: NestJS + TypeScript (enterprise patterns, type safety, DI)  
**Database**: PostgreSQL (ACID, JSONB, full-text search)  
**Cache/Queue**: Redis (Bull queues for async LLM processing)  
**AI**: OpenAI GPT-4 + Ollama (cloud + local options)  

## Key Technology Decisions

### NestJS + TypeScript
- **Why**: Modular architecture, decorator-based DI, enterprise-grade patterns
- **Benefits**: Type safety, maintainable modules, extensive ecosystem
- **Pattern**: Controller → Service → Repository layers

### PostgreSQL + TypeORM  
- **Why**: JSONB for metadata, ACID compliance, full-text search
- **Usage**: Message storage, document relationships, code references
- **Pattern**: Entity decorators, migration-based schema

### Redis + Bull Queue
- **Why**: In-memory performance, robust queue management
- **Usage**: LLM processing jobs, caching, rate limiting
- **Pattern**: Priority queues with retry logic

### Multi-LLM Support
```typescript
LLM_PROVIDER=openai|ollama
// Strategy pattern for provider switching
```

## Integration Stack

**Slack**: @slack/bolt (official SDK, webhook handling)  
**GitHub**: Octokit (official SDK, PR automation)  
**Jira**: Atlassian SDK (REST API integration)  

## Development Tools

**Testing**: Jest (unit + integration + e2e)  
**Quality**: ESLint + Prettier  
**Docs**: OpenAPI/Swagger  
**Deployment**: Docker + PM2  

## Architecture Patterns

- **Dependency Injection**: Constructor-based with NestJS decorators
- **Error Handling**: Custom exception filters + Result pattern  
- **Caching**: Redis with TTL strategies
- **Queue Processing**: Async jobs with exponential backoff
- **Database**: Repository pattern with TypeORM entities

 
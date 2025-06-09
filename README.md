# Knowledge Sync AI

AI-powered knowledge management system that collects data from Slack and Jira, processes it with LLM, and generates markdown documentation in GitHub.

## 🎯 Overview

Knowledge Sync AI automatically:
- 📥 Collects important conversations from Slack and Jira issues
- 🧠 Processes content using GPT-4 for summarization and classification
- 📝 Generates structured markdown documentation
- 🔄 Creates GitHub Pull Requests for team review
- 🗂️ Organizes documents by topic/product rather than chronologically

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Slack    │    │    Jira     │    │   GitHub    │
│   Events    │    │  Webhooks   │    │     API     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                ┌─────────▼─────────┐
                │  Knowledge Sync   │
                │       AI          │
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │     GPT-4         │
                │   Processing      │
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │   Markdown Docs   │
                │   + GitHub PR     │
                └───────────────────┘
```

## 🚀 Features

### Data Collection
- **Slack Integration**: Monitors channels for specific reactions (📝, 📋, 🔖) or keywords
- **Jira Integration**: Processes issue updates and comments via webhooks
- **Smart Filtering**: Only processes content marked as important

### Code Tracking & Linking (Phase 1)
- **GitHub Link Parsing**: Automatically detects GitHub links in documents with various formats:
  - Single line: `[코드 예시](github://owner/repo/src/file.ts:15)`
  - Line range: `[코드 범위](github://owner/repo/src/file.ts:15-20)`
  - Function: `[함수 설명](github://owner/repo/src/file.ts#functionName)`
  - Class method: `[클래스 메서드](github://owner/repo/src/file.ts#Class.method)`
- **Code Extraction**: Automatically extracts code snippets from GitHub repositories
- **Document Enhancement**: Replaces GitHub links with embedded code snippets
- **Change Tracking**: Monitors code changes through content hashing
- **API Endpoints**: RESTful APIs for code reference management

### AI Processing
- **Summarization**: Extracts key points, decisions, and action items
- **Classification**: Categorizes content into predefined topics
- **Context Awareness**: Maintains conversation context and participant information

### Document Generation
- **Structured Markdown**: Consistent formatting with metadata
- **Topic-based Organization**: Groups by product/feature rather than date
- **Update Detection**: Merges new information with existing documents

### GitHub Integration
- **Automated PRs**: Creates pull requests with generated documentation
- **Review Workflow**: Assigns reviewers and adds appropriate labels
- **Branch Management**: Creates feature branches for each update

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Slack App with Bot Token
- Jira API Access
- GitHub Personal Access Token
- OpenAI API Key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd knowledge-ai
   ```

2. **Install dependencies** (includes localtunnel for development)
   ```bash
   make install
   ```

3. **Set up environment variables**
   ```bash
   cp env.template .env
   ```
   
   Then edit `.env` with your specific configuration values.

4. **Set up the database**
   ```bash
   pnpm run build
   pnpm run start:prod
   ```

## 🚀 Quick Start

For **local development** with Slack webhook testing:

```bash
# Start development server with automatic tunnel setup
make dev
```

This command will:
- 🚇 Start localtunnel to expose your local server
- 📋 Display the webhook URL for Slack configuration
- 🔥 Start the NestJS server with live reload
- 📊 Show real-time server logs

**Example output:**
```
🚀 Starting development environment...
Starting localtunnel...
✅ Tunnel ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SLACK CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Tunnel URL: https://abc123.loca.lt
📝 Event Subscription URL: https://abc123.loca.lt/slack/events
🔗 Slack API: https://api.slack.com/apps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Starting NestJS server... (Ctrl+C to stop all services)

[Server logs appear here...]
```

### 🛠️ Development Commands

```bash
# Install dependencies and tools
make install

# Start development environment (tunnel + server)
make dev

# Check tunnel URL anytime
make tunnel-url

# Stop all services
make stop

# Force kill all processes
make clean

# Nuclear option: kill ALL related processes
make kill-all

# Check service status
make status

# Show all available commands
make help
```

## 🔧 Configuration

### Slack App Setup

1. Create a new Slack app at https://api.slack.com/apps
2. Enable Event Subscriptions:
   - **Request URL**: Use the URL from `make dev` output (e.g., `https://abc123.loca.lt/slack/events`)
   - **Subscribe to Bot Events**: `message.channels`, `reaction_added`
3. Add Bot Token Scopes:
   - `channels:history`
   - `channels:read`
   - `reactions:read`
   - `users:read`
4. Install the app to your workspace

> 💡 **Development Tip**: When running `make dev`, the tunnel URL changes each time. Use `make tunnel-url` to quickly get the current URL for Slack configuration.

### Jira Webhook Setup

1. Go to Jira Settings → System → Webhooks
2. Create webhook with URL: Use your tunnel URL + `/jira/webhook` (e.g., `https://abc123.loca.lt/jira/webhook`)
3. Select events: Issue created, updated, commented

> 💡 **Development Tip**: For local testing, use the tunnel URL from `make dev` or `make tunnel-url`

### GitHub Repository Setup

1. Create a repository for documentation
2. Generate a Personal Access Token with required permissions (see below)
3. Set up branch protection rules for `main` branch
4. Add collaborators who will review generated documentation

#### Repository Collaborators

For the system to automatically assign reviewers to Pull Requests, you need to:

1. **Add Collaborators to Repository**:
   - Go to your GitHub repository → Settings → Collaborators
   - Add team members who will review documentation
   - Each collaborator needs at least "Write" access

2. **Configure Environment Variables**:
   ```bash
   # Optional: Comma-separated list of GitHub usernames
   DEFAULT_REVIEWERS=username1,username2,username3
   ```

3. **Important Notes**:
   - ⚠️ Only repository collaborators can be assigned as reviewers
   - ✅ If reviewer assignment fails, the PR will still be created successfully
   - 💡 Leave `DEFAULT_REVIEWERS` empty to skip automatic reviewer assignment

#### GitHub Token Permissions

Use **Fine-grained Personal Access Tokens** for better security with minimal required permissions:

**Setup Steps:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
2. Click **Generate new token**
3. Configure:
   - **Token name**: `Knowledge Sync AI`
   - **Expiration**: Set appropriate expiration (e.g., 90 days)
   - **Repository access**: Select your documentation repository
   - **Permissions** (Repository level):
     - **Contents**: `Read and write` (create/update files)
     - **Metadata**: `Read` (access repository info)
     - **Pull requests**: `Write` (create PRs)

**Why Fine-grained Tokens?**
- ✅ More secure with minimal permissions
- ✅ Limited to specific repositories
- ✅ Better audit trail
- ✅ Organization approval workflow support

## 🎮 Usage

### Manual Collection

Collect Slack messages with specific reactions:
```bash
curl -X POST http://localhost:3000/slack/collect \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "C1234567890",
    "reactionName": "memo",
    "hours": 24
  }'
```

Collect messages with keywords:
```bash
curl -X POST http://localhost:3000/slack/collect \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "C1234567890",
    "keywords": ["decision", "action item"],
    "hours": 48
  }'
```

### Code Tracking APIs

Process GitHub code links in documents:
```bash
curl -X POST http://localhost:3000/code-tracking/process-document \
  -H "Content-Type: application/json" \
  -d '{
    "id": "doc-123",
    "title": "API Documentation",
    "content": "Check this function: [getUserById](github://myorg/api-server/src/user/user.service.ts#getUserById)"
  }'
```

Update document with embedded code snippets:
```bash
curl -X POST http://localhost:3000/code-tracking/update-document-snippets \
  -H "Content-Type: application/json" \
  -d '{
    "id": "doc-123",
    "title": "API Documentation", 
    "content": "..."
  }'
```

Get code references for a document:
```bash
curl -X GET http://localhost:3000/code-tracking/document/doc-123/references
```

Get all active code references:
```bash
curl -X GET http://localhost:3000/code-tracking/references/active
```

### Automatic Processing

The system automatically processes:
- Slack messages with reactions: 📝 (`:memo:`), 📋 (`:clipboard:`), 🔖 (`:bookmark_tabs:`)
- Slack messages containing keywords: "decision", "action item", "todo", "follow up", "next steps"
- Jira issues when created, updated, or commented

## 📁 Project Structure

```
src/
├── common/
│   ├── dto/              # Data Transfer Objects
│   ├── entities/         # Database entities
│   ├── interfaces/       # TypeScript interfaces
│   ├── decorators/       # Custom decorators
│   ├── guards/           # Authentication guards
│   └── filters/          # Exception filters
├── config/
│   └── database.config.ts
├── modules/
│   ├── slack/            # Slack integration
│   ├── jira/             # Jira integration
│   ├── github/           # GitHub integration
│   ├── llm/              # LLM processing
│   ├── document/         # Document orchestration
│   ├── code-tracking/    # Code tracking & linking (Phase 1)
│   └── database/         # Database operations
└── main.ts
```

## 🔍 Available Topics

The system classifies content into these predefined topics:
- `product-planning`
- `technical-architecture`
- `bug-reports`
- `feature-requests`
- `team-decisions`
- `project-updates`
- `security`
- `performance`
- `user-feedback`
- `general-discussion`

## 🧪 Testing

Knowledge Sync AI includes comprehensive unit and integration tests to ensure reliability and maintainability.

### Running Tests

```bash
# Unit tests
pnpm test

# Watch mode for development
pnpm test:watch

# Test coverage
pnpm test:cov

# Debug tests
pnpm test:debug

# E2E tests (requires test database)
pnpm test:e2e

# Complete E2E test cycle (start DB → run tests → cleanup)
pnpm test:e2e:full
```

> 🚀 **Quick Development Workflow**: Use `make dev` for live development and testing with webhooks!

### E2E Testing Setup

The e2e tests require a separate test database to avoid conflicts with your development environment. We've included a Docker Compose configuration specifically for testing.

#### Test Database Management

```bash
# Start test database containers
pnpm test:db:up

# Run e2e tests (database must be running)
pnpm test:e2e

# Stop and cleanup test database
pnpm test:db:down

# Automated: Start DB → Run tests → Cleanup (recommended)
pnpm test:e2e:full
```

#### Test Database Configuration

The test setup uses:
- **PostgreSQL**: Port 5433 (to avoid conflicts with dev DB on 5432)
- **Redis**: Port 6380 (to avoid conflicts with dev Redis on 6379)
- **Database**: `test_db` with user `test` / password `test`

Configuration files:
- `docker-compose.test.yml` - Test database containers
- `test/setup.ts` - Test environment configuration
- `test/jest-e2e.json` - Jest E2E configuration

### Test Structure

```
src/
├── modules/
│   ├── slack/
│   │   ├── slack.service.spec.ts
│   │   └── slack.controller.spec.ts
│   ├── llm/
│   │   └── llm.service.spec.ts
│   ├── github/
│   │   └── github.service.spec.ts
│   └── document/
│       └── document.service.spec.ts
├── app.controller.spec.ts
└── app.service.spec.ts

test/
├── app.e2e-spec.ts          # E2E test cases
├── jest-e2e.json           # Jest E2E configuration
├── setup.ts                # Test environment setup
└── docker-compose.test.yml # Test database containers
```

### Test Coverage

The test suite covers:
- **Unit Tests**: Individual service and controller methods
- **Integration Tests**: Module interactions and workflows
- **E2E Tests**: Complete API endpoints and workflows with real database
- **Mocking**: External services (Slack, GitHub, OpenAI, Jira)

### Test Configuration

Tests are configured with:
- **Jest**: Testing framework with TypeScript support
- **Supertest**: HTTP assertion library for E2E tests
- **Docker**: Isolated test database environment
- **Mock Services**: All external APIs are mocked for reliable testing
- **Coverage Reports**: Generated in `coverage/` directory

### Writing Tests

When adding new features:
1. Write unit tests for services and controllers
2. Mock external dependencies
3. Test both success and error scenarios
4. Add E2E tests for new API endpoints
5. Maintain test coverage above 80%

Example test structure:
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<DependencyType>;

  beforeEach(async () => {
    // Setup test module
  });

  describe('methodName', () => {
    it('should handle success case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Test error handling
    });
  });
});
```

#### E2E Test Example

```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
      });
  });
});
```

## 🚀 Deployment

### Using Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main

### Using Docker

```bash
# Build image
docker build -t knowledge-sync-ai .

# Run container
docker run -p 3000:3000 --env-file .env knowledge-sync-ai
```

## 📊 Monitoring

The application provides logging for:
- Message processing status
- LLM API usage and costs
- GitHub API rate limits
- Error tracking and debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the [Issues](../../issues) page
2. Review the documentation
3. Contact the development team

---

*Built with ❤️ using NestJS, OpenAI GPT-4, and TypeScript*

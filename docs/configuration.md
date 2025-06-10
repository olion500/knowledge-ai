# Configuration

## Environment Variables

### Core Application
```env
# Basic Setup
NODE_ENV=development|production
PORT=3000
LOG_LEVEL=debug|info|warn|error

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/knowledge_ai
REDIS_URL=redis://localhost:6379
```

### LLM Configuration
```env
# Provider Selection
LLM_PROVIDER=openai|ollama

# OpenAI (Production)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=4000

# Ollama (Local/Development)  
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2|codellama|mistral
```

### Integration APIs
```env
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_APP_TOKEN=xapp-...

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=knowledge-docs
GITHUB_DEFAULT_REVIEWERS=user1,user2

# Jira
JIRA_BASE_URL=https://yourorg.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=...
```

## LLM Provider Setup

### OpenAI Configuration
1. **API Key**: Get from OpenAI dashboard
2. **Model Selection**: `gpt-4-turbo-preview` (recommended)
3. **Rate Limits**: 500 requests/min default
4. **Cost Monitoring**: Track token usage

### Ollama Local Setup  
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull model
ollama pull llama2
ollama pull codellama  # For code analysis

# Start service
ollama serve
```

## Integration Setup

### Slack App Configuration
1. **Create Slack App**: https://api.slack.com/apps
2. **Bot Token Scopes**:
   - `channels:history` - Read channel messages
   - `reactions:read` - Read message reactions  
   - `users:read` - Get user information
3. **Event Subscriptions**: Enable and set webhook URL
4. **Install to Workspace**: Generate bot token

### GitHub Personal Access Token
1. **Settings → Developer Settings → Personal Access Tokens**
2. **Required Scopes**:
   - `repo` - Repository access
   - `pull_requests:write` - Create PRs
   - `contents:write` - File management
3. **Organization Access**: Grant if using org repos

### Jira Integration
1. **API Token**: Account Settings → Security → API Tokens
2. **Webhook Setup**: Project Settings → System → Webhooks
3. **Required Permissions**:
   - Read issues and comments
   - Browse projects
   - View development tools

## Health Checks & Monitoring

### Health Endpoints
```typescript
GET /health/status     # Overall system health
GET /health/db        # Database connectivity
GET /health/redis     # Redis connectivity  
GET /health/llm       # LLM provider status
GET /health/slack     # Slack API status
GET /health/github    # GitHub API status
```

### Common Issues & Solutions

**Database Connection Issues:**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

**LLM Provider Failures:**
```bash
# Test OpenAI
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Test Ollama
curl http://localhost:11434/api/version
```

**Integration Auth Issues:**
```bash
# Test Slack token
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test

# Test GitHub token  
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

## Configuration Validation

### Startup Checks
- Validate all required environment variables
- Test database and Redis connectivity
- Verify LLM provider access
- Check integration API credentials
- Load configuration schemas

### Runtime Monitoring
- Monitor API rate limits and quotas
- Track LLM token usage and costs
- Log configuration changes
- Alert on credential expiration 
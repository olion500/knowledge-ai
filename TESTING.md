# Testing Guide for Knowledge Sync AI

This document provides comprehensive information about testing in the Knowledge Sync AI project.

## 📋 Overview

The project includes multiple types of tests to ensure reliability and maintainability:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete workflows
- **Mock Tests**: Test with external service mocks

## 🏗️ Test Structure

```
src/
├── modules/
│   ├── slack/
│   │   ├── slack.service.spec.ts          # Unit tests for Slack service
│   │   ├── slack.controller.spec.ts       # Unit tests for Slack controller
│   │   └── slack-event.handler.spec.ts    # Unit tests for event handler
│   ├── jira/
│   │   ├── jira.service.spec.ts           # Unit tests for Jira service
│   │   └── jira.controller.spec.ts        # Unit tests for Jira controller
│   ├── llm/
│   │   └── llm.service.spec.ts            # Unit tests for LLM service
│   ├── github/
│   │   └── github.service.spec.ts         # Unit tests for GitHub service
│   └── document/
│       └── document.service.spec.ts       # Unit tests for Document service
├── common/
│   └── entities/
│       └── base.entity.spec.ts            # Unit tests for base entity
├── app.controller.spec.ts                 # Unit tests for app controller
└── app.service.spec.ts                    # Unit tests for app service

test/
├── app.e2e-spec.ts                        # E2E tests for main app
├── slack.e2e-spec.ts                      # E2E tests for Slack endpoints
├── jira.e2e-spec.ts                       # E2E tests for Jira endpoints
├── setup.ts                               # Test setup and configuration
└── jest-e2e.json                          # E2E Jest configuration
```

## 🧪 Test Categories

### Unit Tests

Test individual services and controllers in isolation:

```typescript
describe('SlackService', () => {
  let service: SlackService;
  let mockWebClient: jest.Mocked<WebClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SlackService>(SlackService);
  });

  it('should fetch channel history', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Test interactions between multiple components:

```typescript
describe('Document Processing Integration', () => {
  it('should process Slack messages end-to-end', async () => {
    // Test complete workflow from Slack message to GitHub PR
  });
});
```

### E2E Tests

Test complete API workflows:

```typescript
describe('Slack API (e2e)', () => {
  it('/slack/collect (POST)', () => {
    return request(app.getHttpServer())
      .post('/slack/collect')
      .send({
        channelId: 'C1234567890',
        reactionName: 'memo',
      })
      .expect(200);
  });
});
```

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
    '!**/main.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],
};
```

### Test Setup (`test/setup.ts`)

```typescript
// Global test configuration
jest.setTimeout(30000);

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.GITHUB_TOKEN = 'ghp_test-token';
process.env.OPENAI_API_KEY = 'sk-test-key';

// Global cleanup
afterEach(() => {
  jest.clearAllMocks();
});
```

## 🎯 Running Tests

### Basic Commands

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Debug tests
npm run test:debug
```

### Specific Test Patterns

```bash
# Run tests for specific module
npm run test -- slack

# Run specific test file
npm run test -- slack.service.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="should process"
```

## 🎭 Mocking External Services

### Slack API Mocking

```typescript
jest.mock('@slack/web-api');

const mockWebClient = {
  conversations: {
    list: jest.fn(),
    history: jest.fn(),
  },
  users: {
    info: jest.fn(),
  },
};
```

### GitHub API Mocking

```typescript
jest.mock('@octokit/rest');

const mockOctokit = {
  repos: {
    getContent: jest.fn(),
    createFile: jest.fn(),
  },
  pulls: {
    create: jest.fn(),
  },
};
```

### OpenAI API Mocking

```typescript
jest.mock('openai');

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'mocked response' } }],
      }),
    },
  },
};
```

## 📊 Coverage Requirements

### Minimum Coverage Targets

- **Overall Coverage**: 80%
- **Services**: 90%
- **Controllers**: 85%
- **Critical Paths**: 95%

### Coverage Reports

```bash
# Generate coverage report
npm run test:cov

# View coverage in browser
open coverage/lcov-report/index.html
```

## 🔍 Test Data Management

### Test Fixtures

Create reusable test data:

```typescript
// test/fixtures/slack-messages.ts
export const mockSlackMessages = [
  {
    id: '1234567890.123456',
    channel: 'C1234567890',
    user: 'U1234567890',
    text: 'Test message',
    timestamp: '1234567890.123456',
  },
];
```

### Database Testing

For integration tests requiring database:

```typescript
beforeEach(async () => {
  // Clear test database
  await getConnection().synchronize(true);
});

afterEach(async () => {
  // Clean up test data
  await getConnection().dropDatabase();
});
```

## 🚨 Testing Best Practices

### 1. Test Structure

```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    // Initialize test environment
  });

  describe('methodName', () => {
    it('should handle success case', () => {
      // Test successful execution
    });

    it('should handle error case', () => {
      // Test error handling
    });

    it('should validate input', () => {
      // Test input validation
    });
  });
});
```

### 2. Assertion Guidelines

```typescript
// Good: Specific assertions
expect(result.status).toBe('success');
expect(result.data).toHaveLength(3);
expect(result.timestamp).toBeInstanceOf(Date);

// Avoid: Generic assertions
expect(result).toBeTruthy();
expect(result).toBeDefined();
```

### 3. Mock Management

```typescript
// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Restore original implementations
afterAll(() => {
  jest.restoreAllMocks();
});
```

### 4. Async Testing

```typescript
// Use async/await for promises
it('should process async operation', async () => {
  const result = await service.processData();
  expect(result).toBeDefined();
});

// Test error handling
it('should handle async errors', async () => {
  await expect(service.failingOperation()).rejects.toThrow('Error message');
});
```

## 🔧 Debugging Tests

### Debug Configuration

```bash
# Debug specific test
npm run test:debug -- --testNamePattern="specific test"

# Debug with breakpoints
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Common Issues

1. **Timeout Errors**: Increase timeout for slow operations
2. **Mock Leakage**: Ensure mocks are cleared between tests
3. **Database State**: Reset database state between tests
4. **Environment Variables**: Use test-specific environment

## 📈 Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:cov
      - run: npm run test:e2e
```

### Coverage Reporting

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info
```

## 📝 Writing New Tests

### Checklist for New Features

- [ ] Unit tests for all public methods
- [ ] Error handling tests
- [ ] Integration tests for workflows
- [ ] Mock external dependencies
- [ ] Test edge cases and boundary conditions
- [ ] Verify test coverage meets requirements

### Test Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service-name.service';

describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceName],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('methodName', () => {
    it('should return expected result', () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

This testing guide ensures comprehensive coverage and maintainable test suites for the Knowledge Sync AI project. 
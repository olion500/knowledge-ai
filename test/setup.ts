// Jest setup file for global test configuration

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_USERNAME = 'test';
process.env.DATABASE_PASSWORD = 'test';
process.env.DATABASE_NAME = 'test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
process.env.JIRA_HOST = 'https://test.atlassian.net';
process.env.JIRA_USERNAME = 'test@example.com';
process.env.JIRA_API_TOKEN = 'test-jira-token';
process.env.GITHUB_TOKEN = 'ghp_test-github-token';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
process.env.OPENAI_API_KEY = 'sk-test-openai-key';
process.env.OPENAI_MODEL = 'gpt-4-turbo-preview';
process.env.MAX_TOKENS = '4000';
process.env.TEMPERATURE = '0.3';
process.env.DEFAULT_REVIEWERS = 'reviewer1,reviewer2';
process.env.DOCS_BASE_PATH = 'docs';

// Global afterEach to clean up mocks
afterEach(() => {
  jest.clearAllMocks();
});

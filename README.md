# Knowledge AI

AI-powered knowledge management system: Slack/Jira → LLM Processing → GitHub Documentation

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x
- pnpm 10.x
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/knowledge-ai.git
cd knowledge-ai
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp env.template .env
```

4. Start development services:
```bash
docker-compose up -d
```

### Development

프로젝트는 두 가지 방법으로 실행할 수 있습니다:

#### 1. Makefile 사용 (권장)

모든 서비스를 한 번에 실행:
```bash
make dev-all
```

또는 개별적으로 실행:
```bash
# 백엔드 서버 실행
make dev-backend

# Admin 대시보드 실행
make dev-admin
```

#### 2. 수동 실행

1. 백엔드 서버 실행:
```bash
# From the root directory
cd apps/backend
pnpm dev
```

2. Admin 대시보드 실행:
```bash
# From the root directory
cd apps/admin
pnpm dev
```

서비스 접속 주소:
- Admin 대시보드: `http://localhost:3001`
- Backend API: `http://localhost:3000`

#### 유용한 Makefile 명령어

```bash
make help         # 사용 가능한 모든 명령어 보기
make install      # 의존성 설치
make dev-all      # 모든 서비스 실행
make stop         # 모든 서비스 중지
make clean        # 의존성 및 도커 볼륨 정리
make test         # 모든 테스트 실행
```

### Environment Configuration

환경 변수는 두 가지 방법으로 설정할 수 있습니다:

1. Admin 대시보드 사용:
   - `http://localhost:3001/settings` 접속
   - 각 서비스별 환경 변수 설정
   - 변경사항 저장

2. 직접 .env 파일 수정:
   ```bash
   # GitHub 설정
   GITHUB_TOKEN=your_token
   GITHUB_WEBHOOK_SECRET=your_secret
   GITHUB_ORGANIZATION=your_org

   # Slack 설정
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_APP_TOKEN=xapp-your-token
   SLACK_SIGNING_SECRET=your_secret

   # Jira 설정
   JIRA_HOST=your_jira_host
   JIRA_EMAIL=your_email
   JIRA_API_TOKEN=your_token

   # LLM 설정
   OPENAI_API_KEY=your_key
   OLLAMA_HOST=http://localhost:11434
   LLM_PROVIDER=openai # or ollama

   # 데이터베이스 설정
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=knowledge_ai
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres

   # Redis 설정
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

## 📦 Project Structure

```
knowledge-ai/
├── apps/
│   ├── backend/        # NestJS 백엔드
│   └── admin/         # Next.js 어드민 대시보드
├── packages/
│   ├── ui/            # 공통 UI 컴포넌트
│   ├── config/        # 공통 설정
│   └── types/         # 공통 타입 정의
└── docs/             # 프로젝트 문서
```

## 🛠 Development Stack

- **Backend**: NestJS + TypeScript
- **Frontend**: Next.js + TypeScript
- **Database**: PostgreSQL + Redis
- **AI/LLM**: OpenAI API / Ollama
- **UI**: Tailwind CSS + Shadcn UI
- **State Management**: TanStack Query
- **Build Tool**: Turborepo

## 📚 Documentation

자세한 문서는 `docs` 디렉토리를 참조하세요:

- [Project Overview](./docs/project-overview.md)
- [Tech Stack](./docs/tech-stack.md)
- [Project Structure](./docs/project-structure.md)
- [Requirements](./docs/requirements.md)
- [Features](./docs/features.md)
- [Configuration](./docs/configuration.md)
- [Implementation](./docs/implementation.md)
- [Roadmap](./docs/roadmap.md)

## 🧪 Testing

```bash
# 백엔드 테스트
cd apps/backend
pnpm test        # 단위 테스트
pnpm test:e2e    # E2E 테스트
pnpm test:cov    # 커버리지 리포트

# 프론트엔드 테스트
cd apps/admin
pnpm test
```

## 🐳 Docker

전체 스택 실행:
```bash
docker-compose up -d
```

개발 환경 서비스만 실행:
```bash
docker-compose up -d postgres redis
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

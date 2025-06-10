# Knowledge AI Documentation

## Purpose
AI-powered knowledge management system: Slack/Jira → LLM Processing → GitHub Documentation

## Documentation Map

### Core Context
- **[Project Overview](./project-overview.md)** - Vision, goals, problem statement
- **[Tech Stack](./tech-stack.md)** - Technologies and architecture decisions
- **[Project Structure](./project-structure.md)** - Code organization and data models

### Implementation Reference  
- **[Requirements](./requirements.md)** - Functional and technical specifications
- **[Features](./features.md)** - Feature specifications and business rules
- **[Configuration](./configuration.md)** - Setup and integration guide
- **[Implementation](./implementation.md)** - Development patterns and standards
- **[Roadmap](./roadmap.md)** - Current status and future plans

## Quick Context for Code Generation

**Stack**: NestJS + TypeScript + PostgreSQL + Redis + OpenAI/Ollama  
**Pattern**: Event-driven modules with dependency injection  
**Testing**: Jest with 85%+ coverage requirement  
**Data Flow**: Webhooks → Queues → LLM → Documents → GitHub PRs  

## Key Entities
```typescript
Message: source + content + metadata → processing
Document: generated markdown with code links
CodeReference: GitHub links → embedded snippets
```

**Primary Modules**: slack, jira, llm, github, document, code-tracking

## 📋 Documentation Overview

### Core Project Documents

#### [🎯 Project Overview](./project-overview.md)
Contains the core vision statement, main goals, and a high-level explanation of what Knowledge AI aims to solve. This document acts as the "north star" that guides all other decisions.

#### [📋 Requirements](./requirements.md)  
Breaks down both functional requirements (what the system needs to do) and technical requirements (how it needs to perform), including performance benchmarks and quality standards.

#### [🏗️ Project Structure](./project-structure.md)
Outlines the system's architecture - how different modules connect and communicate, database structure, data flow, and development patterns.

#### [⚙️ Tech Stack](./tech-stack.md)
Justifies the technology choices, explaining why specific tools, frameworks, and languages were selected for different parts of the project and how they work together.

### Feature & Implementation Guides

#### [🚀 Features](./features.md)
Dives deeper into individual features, describing exactly how each one should work, including edge cases, business rules, and validation requirements.

#### [🔧 Configuration](./configuration.md)
Comprehensive guide for setting up and configuring the application, including LLM providers, integrations, and environment variables.

#### [💻 Implementation Guide](./implementation.md)
Covers development approach, coding standards, testing requirements, and technical guidelines for contributors.

### Planning & Future

#### [🗺️ Roadmap](./roadmap.md)
Development roadmap with current status, upcoming features, priority matrix, and long-term vision for the Knowledge AI platform.

## 📖 How to Use This Documentation

### For New Users
1. Start with [Project Overview](./project-overview.md) to understand what Knowledge AI does
2. Review [Requirements](./requirements.md) to see if it fits your needs  
3. Follow [Configuration](./configuration.md) to set up the system
4. Check [Features](./features.md) to learn about available functionality

### For Developers
1. Read [Project Overview](./project-overview.md) and [Tech Stack](./tech-stack.md) for context
2. Study [Project Structure](./project-structure.md) to understand the codebase
3. Follow [Implementation Guide](./implementation.md) for development standards
4. Review [Roadmap](./roadmap.md) to see upcoming work

### For Contributors
1. Understand the project via [Project Overview](./project-overview.md)
2. Review [Requirements](./requirements.md) and [Features](./features.md)
3. Follow [Implementation Guide](./implementation.md) for coding standards
4. Check [Roadmap](./roadmap.md) for contribution opportunities

## 🔄 Document Maintenance

These documents are living resources that evolve with the project:
- **Project Overview**: Updated when vision or goals change  
- **Requirements**: Updated when new features are planned
- **Project Structure**: Updated when architecture changes
- **Tech Stack**: Updated when technologies are added/changed
- **Features**: Updated when features are added/modified
- **Configuration**: Updated when setup process changes
- **Implementation Guide**: Updated when development practices change
- **Roadmap**: Updated quarterly or when priorities shift

---

*For questions about this documentation, please see the main [README](../README.md) or open an issue.* 
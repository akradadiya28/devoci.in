<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# DevOci 🚀

[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-v18%2B-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

**A production-ready, open-source developer content platform with AI-powered personalization.**

</div>

---

## What is DevOci?

DevOci is a **content aggregation and personalization platform** designed for developers. Think of it as your personalized developer news feed that learns what you like and serves relevant content.

**Key Highlights:**

- 📰 Aggregates content from 50+ developer sources
- 🤖 AI-powered content scoring and personalization
- 🎯 Role-based feeds (Frontend, Backend, DevOps, etc.)
- 🏆 Gamification with streaks and achievements
- 💳 Built-in subscription billing

---

## Features

| Category | Features |
|----------|----------|
| **API** | GraphQL with 60+ endpoints, REST webhooks |
| **Auth** | JWT + OAuth (Google, GitHub) |
| **Database** | MongoDB with Redis caching |
| **AI** | Gemini-powered content scoring |
| **Billing** | Stripe subscriptions & invoices |
| **Email** | Resend + Gmail SMTP fallback |
| **Workers** | Background jobs for RSS, email, scoring |
| **Security** | Rate limiting, Sentry error tracking |
| **Realtime** | WebSocket notifications via Redis Pub/Sub |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript |
| **API** | Apollo GraphQL + Express |
| **Database** | MongoDB (Mongoose ODM) |
| **Cache** | Redis (ioredis) |
| **Auth** | JWT + Passport.js |
| **Email** | Resend / Nodemailer |
| **Billing** | Stripe |
| **AI** | Google Gemini |
| **Monitoring** | Sentry |
| **Process** | PM2 Clustering |

---

## Folder Structure

```
devoci/
├── apps/
│   ├── api/           # GraphQL API Server (@devoci/api)
│   ├── ws/            # WebSocket Gateway (@devoci/ws)
│   └── web/           # Next.js Frontend (Coming Soon)
├── docs/              # Documentation
│   ├── OPEN_CORE.md   # Architecture Guide
│   └── DEPLOYMENT_GUIDE.md
├── .github/           # Issue templates, CI workflows
├── .env.example       # Environment template
├── docker-compose.yml # Local dev with Docker
└── ecosystem.config.js # PM2 config
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- MongoDB (local or Atlas)
- Redis (local or cloud)

### Installation

```bash
# Clone
git clone https://github.com/yourusername/devoci.git
cd devoci

# Install
pnpm install

# Configure
cp .env.example .env
# Edit .env with your values

# Run API
cd apps/api
pnpm dev
# → http://localhost:4000/graphql
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_SECRET` | Secret for JWT signing | ✅ |
| `GEMINI_API_KEY` | Google AI API key | ⚠️ For AI features |
| `STRIPE_SECRET_KEY` | Stripe API key | ⚠️ For billing |
| `RESEND_API_KEY` | Resend email API key | ⚠️ For emails |
| `GOOGLE_CLIENT_ID` | OAuth client ID | ⚠️ For Google login |
| `GITHUB_CLIENT_ID` | OAuth client ID | ⚠️ For GitHub login |

See [.env.example](./.env.example) for all available options.

---

## Contribution

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

**Quick Start:**

1. Fork the repo
2. Create a branch: `git checkout -b feat/my-feature`
3. Make changes & test
4. Submit a PR

> ⚠️ This project uses **Open Core** architecture.
> Do not modify `apps/api/src/ee/` - it's proprietary and gitignored.

---

## License

This project is licensed under the **Elastic License 2.0 (ELv2)**.

- ✅ Self-host for personal/internal use
- ✅ Modify and contribute
- ❌ Cannot offer as a managed service

See [LICENSE](./LICENSE) for full terms.

---

<div align="center">

**Built with ❤️ for developers**

[Documentation](./docs/) · [Report Bug](./.github/ISSUE_TEMPLATE/bug_report.md) · [Request Feature](./.github/ISSUE_TEMPLATE/feature_request.md)

</div>

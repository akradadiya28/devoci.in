# Open Core Architecture

DevOci follows an **Open Core** architecture. This means the core platform is open source (MIT Licensed), while specific enterprise/premium features are kept in a separate, private module.

## 🏗 Directory Structure

```text
apps/api/src/
├── services/           # Public Service Interfaces (with Fallbacks)
├── ee/                 # Enterprise Edition Code (GitIgnored)
│   ├── services/       # Premium Implementations
│   └── graphql/        # Premium/Admin GraphQL Modules
└── ...
```

## 🔌 Extension Mechanism

The codebase uses a **Proxy Pattern** to load premium features:

1. **Public Services**: Files in `src/services` (e.g., `aiRecommendation.ts`) check for the existence of a corresponding module in `src/ee`.
2. **Dynamic Loading**: If the `src/ee` module is found, it is used.
3. **Fallback**: If `src/ee` is missing (Community Edition), the service falls back to a default open-source implementation (e.g., "Related Articles" instead of "AI Personalized Feed").

## 🛡️ Security & Privacy

* **Secrets**: All API keys (Stripe, AI, etc.) are managed via environment variables (`.env`).
* **Isolation**: Premium code in `src/ee` is strictly ignored via `.gitignore` and will never be pushed to the public repository.
* **Safety**: The public codebase compiles and runs perfectly without the private modules.

## 🤝 Contributing

We welcome contributions to the Core!

* Please verify your changes run correctly in "Community Mode" (without `src/ee`).
* Do not modify the `try { require('../ee/...') }` blocks in services.

## 💼 Enterprise Features

The following features are currently part of the Enterprise Edition:

* Gemini AI Content Scoring
* Personalized Feed Algorithm (AI)
* Gamification Engine (Detailed Stats)
* Admin GraphQL API
* Weekly Learning Plan Generation

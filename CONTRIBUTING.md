# Contributing to DevOci 🚀

First off, thanks for taking the time to contribute! We are building the best open-source content platform, and we'd love your help.

## 🏗 Project Architecture

DevOci is a **Monorepo** managed by `pnpm` workspaces.

* `apps/api`: The core Node.js/GraphQL API.
* `apps/ws`: Socket.IO Server for live events.
* `apps/web`: The Next.js Frontend (In Progress).

### ⚠️ Open Core Policy

This project follows an Open Core model.

* **Core (Open)**: Public services in `apps/api/src`.
* **Enterprise (Private)**: Proprietary logic in `apps/api/src/ee`.

**Please do not modify files in `src/ee`.** These are ignored by git.
If your PR changes Core logic that might break Enterprise extensions, please discuss it in an issue first.

## 🚀 Getting Started

### Prerequisites

* Node.js 18+

* pnpm (`npm install -g pnpm`)
* MongoDB & Redis (Running locally or via Docker)

### Installation

1. **Fork & Clone**:

    ```bash
    git clone https://github.com/your-username/devoci.git
    cd devoci
    ```

2. **Install Dependencies**:

    ```bash
    pnpm install
    ```

3. **Environment Setup**:

    ```bash
    cp .env.example .env
    # Open .env and add your MONGODB_URI and REDIS_URL
    ```

4. **Run Development**:

    ```bash
    # Run API
    cd apps/api
    pnpm dev
    ```

## 📐 Coding Standards

* **TypeScript**: We use strict typing. Avoid `any` wherever possible.
* **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/).
  * `feat: add new graphql resolver`
  * `fix: resolve stripe webhook error`
  * `docs: update readme`
* **Formatting**: We use Prettier. Run `pnpm format` (if script exists) or let your IDE handle it.

## 📥 Submitting a Pull Request

1. **Branch**: Create a branch from `main` (e.g. `feat/my-new-feature`).
2. **Changes**: Make your changes. Keep them focused and small.
3. **Verify**: Ensure code compiles and no secrets are exposed.
4. **Push**: `git push origin feat/my-new-feature`
5. **PR**: Open a PR targeting the `main` branch. Fill out the **Pull Request Template**.

## 🐞 Reporting Bugs

Please use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md) for detailed reports.
For security issues, please refer to [SECURITY.md](.github/SECURITY.md).

## 🤝 Code of Conduct

Be respectful and kind. Harassment or abuse of any kind will not be tolerated.

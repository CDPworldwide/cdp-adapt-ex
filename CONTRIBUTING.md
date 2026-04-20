# Contributing to the project

Thank you for considering contributing to CDP Adaptation & Action Explorer!

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- **Python 3.13+** and [uv](https://astral.sh/uv)
- **Node.js v20+** and **npm**
- **Bun** (required for some tests)
- **PostgreSQL**
- **Google Cloud SDK** (for VertexAI/Gemini integration)

### 2. Set Up Development Environment
For a complete step-by-step setup guide, please refer to **[SETUP.md](SETUP.md)**.

### 3. Pre-commit hooks
To maintain code quality, we use pre-commit hooks. Install them with:
```bash
make setup-hooks
```
These hooks run automatically before each commit to enforce code quality:
- **ruff**: Python linting and formatting (backend)
- **prettier**: JavaScript/TypeScript formatting (frontend)
- **trailing-whitespace**: Remove trailing whitespace
- **end-of-file-fixer**: Ensure files end with a newline

To skip hooks for a single commit: `git commit --no-verify`
To run hooks manually on all files: `pre-commit run --all-files`

---

## 🛠 How to Contribute

### Reporting Bugs
- Use the [GitHub Issue Tracker](https://github.com/CDPworldwide/pac-api/issues).
- Provide a clear, descriptive title.
- Include steps to reproduce, expected behavior, and actual behavior.
- Attach screenshots if applicable.

### Suggesting Enhancements
- Open an issue with the "enhancement" label.
- Explain the use case and why this feature would be valuable.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes (`make test-backend`, `make test-frontend`).
4. Ensure your code follows the style guidelines (run `make lint-fix`).
5. Open a Pull Request against the `main` branch.

---

## 🌳 Branching & Deployment Strategy

We use a branch-based deployment strategy to manage our environments:

- **`main` Branch**: Our primary development branch. Any code merged here is automatically deployed to the **Development** environment.
- **`production` Branch**: Reflects the code currently running in **Production**. To update production, create a Pull Request to merge `main` into `production`.
- **Feature Branches**: All new features and bug fixes should be developed in branches created from `main`.

| Branch | Environment | Auto-Deployment |
|--------|-------------|-----------------|
| `main` | Development | Yes (on push) |
| `production` | Production | Yes (on push) |
| `feature/*` | PR Preview | Yes (on PR open/update) |

---

## 🎨 Style Guidelines

### Backend (Python)
- We use [Ruff](https://github.com/astral-sh/ruff) for linting and formatting.
- Follow PEP 8 guidelines.
- Use strict type hints for all function signatures.

### Frontend (Angular)
- Use Tailwind CSS for styling.
- Avoid hardcoded text; use `@ngx-translate/core` for i18n.

---

## 📄 License
By contributing, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE).

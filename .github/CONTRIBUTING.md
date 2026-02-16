# Contributing to AgentGuard

Thank you for your interest in contributing to AgentGuard! This project aims to build a decentralized Human-as-a-Service (HaaS) governance framework for AI Agents, and we welcome contributions from the community.

## 🏗️ Project Structure

```
agentguard/
├── packages/
│   ├── haas-core/           # TypeScript — Governance engine
│   ├── haas-python-sdk/     # Python — Agent-side SDK
│   ├── haas-dashboard/      # React — Reviewer UI
│   └── shared-proto/        # Shared schemas & types
├── docs/                    # Architecture & documentation
└── .github/                 # CI/CD & templates
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20.0.0
- Python >= 3.11
- npm >= 10.0.0

### Setup

```bash
# Clone the repo
git clone https://github.com/your-org/agentguard.git
cd agentguard

# Install Node.js dependencies
npm install

# Build all packages
npm run build

# Install Python SDK (for development)
cd packages/haas-python-sdk
pip install -e ".[dev]"
```

## 📝 Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the code standards below.

3. **Run tests** before committing:
   ```bash
   # Node.js
   npm run test

   # Python
   cd packages/haas-python-sdk && pytest
   ```

4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add okta identity provider
   fix: handle timeout in consensus aggregator
   docs: update architecture diagram
   ```

5. **Push and open a Pull Request** against `main`.

## 📏 Code Standards

### TypeScript (haas-core, shared-proto, haas-dashboard)
- **Strict mode** enabled — no `any` types
- **ESLint** for linting
- **Prettier** for formatting
- **Vitest** for testing
- JSDoc comments on all public APIs

### Python (haas-python-sdk)
- **Type hints** on all functions
- **ruff** for linting
- **mypy** (strict mode) for type checking
- **pytest** for testing
- Docstrings on all public APIs

## 🧩 Adding a New Identity Provider

One of the most common contributions is adding a new identity provider adapter.

1. Create a new file in `packages/haas-core/src/auth/providers/`
2. Implement the `IIdentityProvider` interface
3. Register it in the factory (`packages/haas-core/src/auth/factory.ts`)
4. Add tests
5. Update the README

Example skeleton:
```typescript
import type { IIdentityProvider, Challenge, VerificationResult, IdentityProof, IdentityClaims, TrustRequirements } from '../types';

export class MyProvider implements IIdentityProvider {
  readonly name = 'my-provider';

  getChallenge(requirements: TrustRequirements): Challenge { /* ... */ }
  async verifyProof(proof: IdentityProof): Promise<VerificationResult> { /* ... */ }
  extractClaims(proof: IdentityProof): IdentityClaims { /* ... */ }
}
```

## 🐛 Reporting Issues

- Use the [GitHub Issues](https://github.com/your-org/agentguard/issues) tab
- Include steps to reproduce, expected vs actual behavior
- Tag with appropriate labels: `bug`, `feature`, `docs`, `identity-provider`

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

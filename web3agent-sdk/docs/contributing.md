# Contributing

## Branch naming

Format: `<type>/<short-description>`

| Type | Use for |
|------|---------|
| `feat` | New features or skills |
| `fix` | Bug fixes |
| `docs` | Documentation changes |
| `refactor` | Code restructuring without behavior change |
| `test` | Test additions or changes |
| `chore` | Dependencies, CI, tooling |

Examples:
- `feat/add-aave-lending-skill`
- `fix/wallet-overwrite-guard`
- `docs/api-reference-examples`

## Conventional commits

Format: `<type>(<scope>): <description>`

Examples scoped to this repo:

```
feat(skills): add Aave V3 lending skill
fix(wallet): guard against concurrent wallet creation
fix(orchestrator): handle empty tool response
docs(quickstart): clarify master wallet funding steps
refactor(config): extract RPC URL builder
test(e2e): validate ERC-8004 registration retry
chore(deps): bump @langchain/anthropic to 0.4.0
```

## Pre-commit checklist

- [ ] `npm run typecheck` passes
- [ ] All new exports have JSDoc comments
- [ ] No secrets or private keys in committed files
- [ ] `.env.example` updated if new env vars were added
- [ ] Docs updated for any public API changes
- [ ] Commit messages use conventional format

## Adding a new skill

1. Create `src/skills/<skill-name>.ts`
2. Export a factory: `(agentPrivateKey: string) => DynamicStructuredTool`
3. Add it to `SKILL_REGISTRY` in `src/skills/index.ts`
4. Add JSDoc to the factory function
5. Document it in `docs/skills.md`
6. Branch name: `feat/add-<skill-name>-skill`
7. Commit: `feat(skills): add <skill-name> skill`

## Code style

- Use typed options objects for functions with more than one parameter
- Keep internal modules private — only export through `src/index.ts`
- Log with `[module-name]` prefix, no emojis
- Handle errors explicitly — throw with actionable messages

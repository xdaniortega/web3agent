# Contributing to web3agent-sdk

Thank you for contributing. This guide covers branch naming, commit format, PR process, and how to add a new skill.

## Branch naming

Use the format: `<type>/<short-description>`

Examples:
- `feat/add-aave-lending-skill`
- `fix/wallet-creation-race-condition`
- `docs/update-quickstart`
- `refactor/skill-registry-types`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a scope when applicable.

Format: `<type>(<scope>): <description>`

Examples for this repo:
- `feat(skills): add Aave V3 lending skill`
- `fix(wallet): prevent overwriting existing wallet on concurrent access`
- `docs(quickstart): add Robinhood Testnet instructions`
- `refactor(orchestrator): extract tool resolution into helper`
- `test(e2e): add balance check assertions`
- `chore(deps): upgrade ethers to v6.14`

Keep the subject line under 72 characters. Use the body for details if needed.

## PR checklist

Before opening a pull request:

- [ ] Code compiles: `npm run typecheck` passes with no errors
- [ ] All exported functions and types have JSDoc comments
- [ ] No secrets, private keys, or wallet files in the diff
- [ ] `.env.example` is updated if new environment variables were added
- [ ] Documentation is updated to reflect any API changes
- [ ] Commit messages follow conventional commit format

## Adding a new skill

1. Create a new file in `src/skills/` (e.g., `src/skills/aave-lend.ts`)
2. Export a factory function with the signature: `(agentPrivateKey: string) => DynamicStructuredTool`
3. Register the skill in `src/skills/index.ts` by adding it to the `SKILL_REGISTRY`
4. Add JSDoc to the factory function
5. Document the skill in `docs/skills.md`
6. Test it by adding it to the skills array in `scripts/test-workflow.ts`

No changes to the orchestrator are needed. The skill registry handles resolution.

## Security

- Never commit `.env` or `agents/*/wallet.json`
- Never log private keys (wallet addresses are fine)
- All token amounts should use `ethers.parseUnits` — never raw BigInt math on user input

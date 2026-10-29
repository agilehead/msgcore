# CLAUDE.md

**NEVER DEPLOY WITHOUT EXPLICIT USER INSTRUCTION**: Deployments to production are STRICTLY FORBIDDEN unless the user explicitly says to deploy. This is a live system with active users. No exceptions — never run deploy scripts, push to production, or trigger any deployment pipeline without a direct, explicit instruction from the user.

**sed USAGE**

NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE
NEVER USE sed TO BULK REPLACE

**NO QUICK FIXES**: Quick fixes and workarounds are banned in this project. Always fix the root cause properly. If a deploy script uploads to the wrong location, fix the deploy script - don't manually sync files.

**NEVER SSH INTO PRODUCTION**: Do not SSH into production servers unless the user explicitly asks you to. Production access requires explicit user authorization for each session.

**NEVER USE FORCE PUSH OR DESTRUCTIVE GIT OPERATIONS**: `git push --force`, `git push --force-with-lease`, `git reset --hard`, `git clean -fd`, or any other destructive git operations are ABSOLUTELY FORBIDDEN. Use `git revert` to undo changes instead.

This file provides guidance to Claude Code when working with the MsgCore conversation service.

## Critical Guidelines

### NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying APIs, interfaces, or data structures
- Changing expected behavior or test expectations
- Adding new dependencies or patterns

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

### NEVER COMMIT DIRECTLY TO MAIN

**CRITICAL**: ALL changes must be made on a feature branch, never directly on main.

- Always create a new branch before making changes (e.g., `feature/add-search`, `fix/unread-count`)
- Push the feature branch and create a pull request
- Only merge to main after user approval

### NEVER COMMIT WITHOUT ALL TESTS PASSING

**CRITICAL**: ALL tests must pass in BOTH local mode AND Docker Compose mode before committing.

- Run `./services/msgcore/scripts/test-integration.sh local` and verify all tests pass
- Run `./services/msgcore/scripts/test-integration.sh compose` and verify all tests pass in Docker
- If Docker Compose tests fail due to schema changes, rebuild Docker images first: `./services/msgcore/scripts/docker-build.sh`
- No exceptions - if tests fail, fix them before committing

### NEVER BLAME "PRE-EXISTING FAILURES"

**CRITICAL**: The excuse "these are pre-existing failures" is NEVER acceptable.

- If tests fail, they must be fixed - period
- If you introduced code that breaks tests, fix your code
- If tests were already broken before your changes, fix those tests too
- The codebase must always be in a clean, passing state
- "It was already broken" is not a valid excuse for leaving things broken

### FINISH DISCUSSIONS BEFORE WRITING CODE

**IMPORTANT**: When the user asks a question or you're in the middle of a discussion, DO NOT jump to writing code. Always:

1. **Complete the discussion first** - Understand the problem fully
2. **Analyze and explain** - Work through the issue verbally
3. **Get confirmation** - Ensure the user agrees with the approach
4. **Only then write code** - After the user explicitly asks you to implement

## Session Startup & Task Management

### First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Check for ongoing tasks in `.todos/` directory** - Look for any in-progress task files
3. **Read the key documentation files** in this order:
   - `/README.md` - Project overview
   - `/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `.env.example` - Configuration options

Only after reading these documents should you proceed with any implementation or analysis tasks.

## Project Overview & Principles

MsgCore is a standalone conversation/messaging service. It provides generic conversation primitives (direct messages, contextual threads, activity tracking) via a GraphQL API. Any project can use it — it has no connection to any specific application.

### Production System

**IMPORTANT**: MsgCore is designed for production deployments:

- **Always use migrations** - All database schema changes MUST use the migration system
- **Never modify initial schema** - The initial migration files are immutable; create new migrations for changes
- **Backward compatibility matters** - Consider existing data when making schema changes
- **All code should follow current best practices** - Maintain high quality standards
- **No change tracking in comments** - Avoid "changed from X to Y" comments in code

### Key Features

- **GraphQL API**: Conversation CRUD, message sending, unread tracking
- **Conversations**: Unified model — DMs, contextual threads, group chats
- **Messages**: Text messages with optional metadata and reply-to threading
- **Activity Tracking**: Per-user badge counts for new conversations
- **Internal API**: Service-to-service endpoints for creating conversations, sending messages, moderation
- **Context Support**: Conversations can be tied to external resources (items, orders, tickets, etc.)

### Documentation & Code Principles

**Documentation Guidelines:**

- Write as if the spec was designed from the beginning
- Be concise and technical - avoid promotional language
- Use active voice and include code examples
- Keep README.md as single source of truth

**Code Principles:**

- **Functional modules** - Use functional style with strict types. C# classes are limited to framework boundaries such as EF entities, DbContext and serializer contexts.
- **NO DYNAMIC IMPORTS** - Always use static imports
- **PREFER FUNCTIONS** - Export functions from modules
- **USE RESULT TYPES** - For error handling
- **PREFER `type` over `interface`**
- **NO EMOJIS** - Do not use emojis in code, logs, or comments

### Environment Variables

**CRITICAL**: NEVER use fallback defaults with `||` for required environment variables.

```typescript
// BAD - silent failure with default value
const host = process.env.MSGCORE_SERVER_HOST || "127.0.0.1";

// GOOD - fail fast if required var is missing
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`ERROR: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}
const host = required("MSGCORE_SERVER_HOST");
```

All environment variables must be validated at startup in `src/config.ts`. The application should fail immediately if required variables are missing.

### Linting and Code Quality Standards

**CRITICAL**: NEVER weaken linting, testing, or type-checking rules:

- **NO eslint-disable comments** - Fix the actual issues instead of suppressing warnings
- **NO test.skip or test.only in committed code** - All tests must run and pass
- **NO @ts-expect-error or @ts-ignore** - Fix type errors properly
- **NO relaxing TypeScript strict mode** - Maintain full type safety
- **NO lowering code coverage thresholds** - Improve coverage instead
- **NO weakening any quality gates** - Standards exist for a reason

When you encounter linting, type, or test errors, the solution is ALWAYS to fix the underlying issue properly, never to suppress or bypass the error. Quality standards are non-negotiable.

**PRE-EXISTING ERRORS**: If you encounter lint, type, or test errors that existed before your changes, you MUST fix them. Pre-existing errors are never an excuse - the codebase must always be in a clean state.

## Key Technical Decisions

### Security: Never Use npx

**CRITICAL SECURITY REQUIREMENT**: NEVER use `npx` for any commands. This poses grave security risks.

- **ALWAYS use exact dependency versions** in package.json
- **ALWAYS use local node_modules binaries**
- **NEVER use `npx`** - use local dependencies

### Security: Never SSH as Root

**CRITICAL**: NEVER SSH to production servers as root.

- **ALWAYS use the application-specific user** (e.g., `msgcoreuser@msgcore.example.com`)
- **NEVER use `root@`** in any SSH commands, scripts, or configurations
- Production uses rootless Docker - each app has its own isolated user and Docker daemon

### Database Conventions

- **SQLite** retains the unchanged Knex schema. C# uses EF LINQ and generated persistence rows.
- **Product queries** use EF LINQ; Knex alone owns schema changes.
- **Repository Pattern** - Functional ports with a SQLite implementation
- **Singular table names**: lowercase (e.g., `conversation`, `message`, `user_activity`)
- **Column names**: snake_case for all columns
- **Random hex IDs** for records (`randomBytes(8).toString("hex")`)
- **Hard deletes** with audit logging
- **MIGRATION POLICY**: Use migration system for all schema changes

### ESM Modules

- **All imports MUST include `.js` extension**: `import { foo } from "./bar.js"`
- **TypeScript configured for `"module": "NodeNext"`**
- **Type: `"module"` in all package.json files**
- **NO DYNAMIC IMPORTS**: Always use static imports

### GraphQL Architecture

- **Single schema file** (`services/msgcore/contracts/graphql/public/schema.graphql`)
- **C# GraphQL adapter** for API execution

## Essential Commands & Workflow

### Build & Development Commands

```bash
# Build entire project (from root)
./scripts/build.sh              # Standard build with formatting
./scripts/build.sh --no-format  # Skip prettier formatting (faster)

# Clean build artifacts
./scripts/clean.sh

# Start server
./services/msgcore/scripts/start.sh

# Lint entire project
./scripts/lint-all.sh           # Run ESLint on all packages
./scripts/lint-all.sh --fix     # Run ESLint with auto-fix

# Format code with Prettier (MUST run before committing)
./scripts/format-all.sh

# Docker commands
./services/msgcore/scripts/docker-build.sh       # Build Docker images (msgcore-migrations, msgcore)

# Integration tests
./services/msgcore/scripts/test-integration.sh local    # Run tests with local server
./services/msgcore/scripts/test-integration.sh compose  # Run tests against Docker Compose
```

### Monitoring Long-Running Operations

When running background operations like deploys, builds, or tests:

- **Check output at most every 30 seconds** - Do not poll in a tight loop
- **Be patient with slow operations** - Docker builds and deploys take time
- **Report progress periodically** - Let the user know when operations complete

### Database Commands

```bash
# Check migration status
npm run migrate:msgcore:status

# Run migrations (ONLY when explicitly asked)
npm run migrate:msgcore:latest
npm run migrate:msgcore:rollback
```

### Testing Commands

```bash
# Run all tests
npm test

# Run specific tests
node services/msgcore/scripts/test-services.mjs csharp
node services/msgcore/scripts/test-services.mjs nativeaot
```

### Git Workflow

**CRITICAL GIT SAFETY RULES**:

1. **NEVER use `git push --force`**
2. **ALL git push commands require EXPLICIT user authorization**
3. **Use revert commits instead of force push**

**NEW BRANCH REQUIREMENT**: ALL changes must be made on a new feature branch, never directly on main.

When the user asks you to commit and push:

1. Run `./scripts/build.sh` to build all packages (this also formats code)
2. Run `./scripts/lint-all.sh` to ensure code passes linting
3. Follow git commit guidelines
4. Get explicit user confirmation before any `git push`

### Pull Request Workflow

**NEVER use `gh pr create` to create pull requests automatically.** Always provide the URL for manual PR creation:

```
https://github.com/agilehead/msgcore/pull/new/<branch-name>
```

After pushing a feature branch, provide this URL to the user so they can create the PR manually with their preferred title and description.

## Core Architecture

### Project Structure

The canonical product root is `services/msgcore/`. The C# subtree follows the same apps/packages/build/scripts/tests structure as Snapped, Persona and TapTap. Root README.md owns the current commands and layout.

```text
services/msgcore/
  package.json
  node/packages/                TypeScript SDK and test tooling
  csharp/{apps,packages,build,scripts,tests}/
  contracts/graphql/
  database/msgcore/sqlite/schema.d.ts
  database/msgcore/sqlite/migrations/
  knexfile.msgcore.mjs
  docker/
  scripts/
  tests/{contracts,http}/
```

### Temporary Directories (gitignored)

These directories are excluded from git and used for temporary data:

- `.tests/` - Test run data (e.g., `.tests/test-1234567890/data/` for test databases)
- `.analysis/` - Analysis output and scratch files
- `.temp/` - General temporary files

### Key Concepts

- **Conversations**: Unified threads between participants, optionally tied to a context (item, order, ticket, etc.)
- **Messages**: Text messages within conversations, with optional metadata and reply-to threading
- **Participants**: Users in a conversation with per-conversation read tracking (last_seen_at)
- **Activity**: Per-user badge tracking — count of conversations with new messages since last seen

### Repository Pattern

The domain owns immutable function-delegate ports; the SQLite adapter implements them using EF LINQ, cancellation and `Result<T>`.

## Environment Variables

See `.env.example` for complete list. Key variables:

### Server

- `MSGCORE_SERVER_HOST` - Server bind address (REQUIRED)
- `MSGCORE_SERVER_PORT` - Server port (default: 5007)

### Database

- `MSGCORE_DATA_DIR` - Directory for SQLite database (REQUIRED)

### Security

- `MSGCORE_INTERNAL_SECRET` - Bearer token for internal API endpoints (REQUIRED)
- `MSGCORE_JWT_SECRET` - JWT secret for token verification (REQUIRED)
- `MSGCORE_CORS_ORIGINS` - Comma-separated allowed origins (REQUIRED)

### Logging

- `LOG_LEVEL` - Log level (default: info)
- `MSGCORE_LOG_FILE_DIR` - Directory for log files (optional)

## Testing Strategy

### Unit Tests

- The C# probe checks conversation, message and activity storage and authentication.

### Integration Tests

- GraphQL API endpoints (conversation queries/mutations, message mutations, activity counts)
- Health check
- Internal API auth + operations

### Test Infrastructure

- Acceptance runs against managed .NET and actual NativeAOT locally and in Docker, using disposable migrated databases.

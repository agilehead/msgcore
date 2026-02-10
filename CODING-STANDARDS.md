# Coding Standards

This document outlines the coding standards and patterns used throughout the MsgCore conversation service codebase. All contributors must follow these guidelines to maintain consistency and quality.

## Core Principles

### 1. Functional Programming First

**NO CLASSES** - Use functions and modules exclusively.

```typescript
// Good - Pure function with explicit dependencies
export function createConversation(
  db: SQLiteDatabase,
  data: CreateConversationData,
): ConversationRow {
  // Implementation
}

// Bad - Service class for stateless operations
export class ConversationService {
  constructor(private db: SQLiteDatabase) {}

  createConversation(data: CreateConversationData): ConversationRow {
    // This should be a function, not a class method
  }
}
```

### 2. Explicit Error Handling

Use explicit error checks. Throw GraphQL errors in resolvers for user-facing errors.

```typescript
// Good - Explicit null checks
const conversation = conversationRepo.findById(id);
if (conversation === null) {
  throw new GraphQLError("Conversation not found");
}
return conversation;
```

### 3. Database Patterns with Tinqer

#### All SQL MUST use Tinqer

**CRITICAL**: Never write raw SQL unless Tinqer cannot support the query (complex joins, UPSERT, etc.).

```typescript
// Good - Tinqer query
import { executeSelect } from "@tinqerjs/better-sqlite3-adapter";
import { schema } from "@agilehead/msgcore-db";

export function findById(db: SQLiteDatabase, id: string): ConversationRow | null {
  const rows = executeSelect(
    db,
    schema,
    (q, p) =>
      q
        .from("conversation")
        .where((c) => c.id === p.id)
        .select((c) => ({ ...c }))
        .take(1),
    { id },
  );

  return rows.length > 0 ? (rows[0] as unknown as ConversationRow) : null;
}
```

#### Repository Pattern

Implement repositories as functional types:

```typescript
// Repository type
export type ConversationRepository = {
  create: (data: CreateConversationData) => ConversationRow;
  findById: (id: string) => ConversationRow | null;
  findByUserId: (userId: string, options: FindOptions) => { rows: ConversationRow[]; totalCount: number };
};

// Repository implementation
export function createConversationRepository(db: SQLiteDatabase): ConversationRepository {
  return {
    create: (data) => {
      // Tinqer insert implementation
    },
    findById: (id) => {
      // Tinqer select implementation
    },
    // ... other methods
  };
}
```

### 4. Module Structure

#### Imports

All imports MUST include the `.js` extension:

```typescript
// Good
import { createConversationRepository } from "./repositories/sqlite/conversation.js";
import type { ConversationRow } from "@agilehead/msgcore-db";

// Bad
import { createConversationRepository } from "./repositories/sqlite/conversation";
```

#### Exports

Use named exports exclusively:

```typescript
// Good
export function createConversation() { ... }
export type Conversation = { ... };

// Bad
export default class ConversationService { ... }
```

### 5. Naming Conventions

#### General Rules

- **Functions**: camelCase (`createConversation`, `sendMessage`, `markSeen`)
- **Types**: PascalCase (`ConversationRow`, `MessageRow`, `UserActivityRow`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`, `MAX_MESSAGE_LENGTH`)
- **Files**: kebab-case (`conversation.ts`, `user-activity.ts`)
- **Database**: snake_case tables and columns (`conversation`, `created_at`, `context_type`)

#### Database Naming

- **Tables**: singular, lowercase (`conversation`, `message`, `user_activity`)
- **Columns**: snake_case (`context_type`, `created_at`, `sender_id`)
- **Foreign Keys**: `{table}_id` (`conversation_id`, `sender_id`)

### 6. TypeScript Guidelines

#### Strict Mode

Always use TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### Type vs Interface

Prefer `type` over `interface`:

```typescript
// Good - Using type
type ConversationRow = {
  id: string;
  context_type: string | null;
  context_id: string | null;
  title: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
};
```

#### Strict Equality Only

**CRITICAL**: Always use strict equality operators (`===` and `!==`). Never use loose equality (`==` or `!=`).

#### Avoid `any`

Never use `any`. Use `unknown` if type is truly unknown.

### 7. Async/Await Pattern

Always use async/await instead of promise chains.

### 8. GraphQL Resolver Patterns

```typescript
export const conversationResolvers = {
  Query: {
    conversation: (_parent: unknown, args: { id: string }, context: Context) => {
      const conv = context.repos.conversations.findById(args.id);
      if (conv === null) {
        throw new GraphQLError("Conversation not found");
      }
      // Verify caller is a participant
      const participant = context.repos.conversations.findParticipant(args.id, context.userId);
      if (participant === null) {
        throw new GraphQLError("Not a participant");
      }
      return conv;
    },
  },
};
```

### 9. Security Patterns

#### Input Validation

Always validate input at system boundaries.

#### Authentication

- Public GraphQL API: JWT verification via Persona shared secret
- Internal API: Bearer token with `MSGCORE_INTERNAL_SECRET`

### 10. Logging

Use structured logging, never console.log:

```typescript
import { createLogger } from "@agilehead/msgcore-logger";

const logger = createLogger("conversation");

// Good - Structured logging
logger.info("Conversation created", { conversationId, participantCount });
logger.error("Failed to send message", { error: error.message, conversationId });

// Bad - console.log
console.log("Conversation created: " + conversationId);
```

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] No classes used
- [ ] All imports include `.js` extension
- [ ] All database queries use Tinqer (no raw SQL unless necessary)
- [ ] Repository pattern implemented for data access
- [ ] No `any` types used
- [ ] Strict equality only (`===`/`!==`, never `==`/`!=`)
- [ ] Tests included for new functionality
- [ ] No console.log statements (use logger)
- [ ] Environment variables validated at startup

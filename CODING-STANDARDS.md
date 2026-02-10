# Coding Standards

This document outlines the coding standards and patterns used throughout the MsgCore conversation service codebase. All contributors must follow these guidelines to maintain consistency and quality.

## Core Principles

### 1. Functional Programming First

**NO CLASSES** - Use functions and modules exclusively.

```typescript
// Good - Pure function with explicit dependencies
export async function createConversation(
  db: SQLiteDatabase,
  data: CreateConversationData,
): Promise<Result<ConversationRow>> {
  // Implementation
}

// Bad - Service class for stateless operations
export class ConversationService {
  constructor(private db: SQLiteDatabase) {}

  async createConversation(data: CreateConversationData): Promise<ConversationRow> {
    // This should be a function, not a class method
  }
}
```

### 2. Explicit Error Handling with Result Types

Use `Result<T>` for all operations that can fail. Never throw exceptions for expected errors.

```typescript
// Result type definition (in types.ts)
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Good - Using Result type
export async function findConversation(db: SQLiteDatabase, id: string): Promise<Result<ConversationRow>> {
  try {
    const rows = executeSelect(
      db,
      schema,
      (q, p) =>
        q
          .from("conversation")
          .where((c) => c.id === p.id)
          .select((c) => ({ ...c }))
          .take(1),
      { id }
    );

    if (rows.length === 0) {
      return {
        success: false,
        error: new Error("Conversation not found"),
      };
    }

    return { success: true, data: rows[0] as unknown as ConversationRow };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Bad - Throwing exceptions
export async function findConversation(db: SQLiteDatabase, id: string): Promise<ConversationRow> {
  const rows = executeSelect(/* ... */);
  if (rows.length === 0) throw new Error("Conversation not found");
  return rows[0];
}
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

// Bad - Raw SQL
export function findById(db: SQLiteDatabase, id: string): ConversationRow | null {
  return db.prepare(`SELECT * FROM conversation WHERE id = ?`).get(id);
}
```

#### DbRow Types

All database types must exactly mirror the database schema with snake_case:

```typescript
// Database schema types (snake_case)
type ConversationRow = {
  id: string;
  context_type: string | null;
  context_id: string | null;
  title: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  metadata: string | null;
  reply_to: string | null;
  created_at: string;
};

type UserActivityRow = {
  user_id: string;
  conversation_id: string;
  last_seen_at: string;
};
```

#### Repository Pattern

Implement repositories as functional interfaces:

```typescript
// Repository interface
export type ConversationRepository = {
  create: (data: CreateConversationData) => Promise<Result<ConversationRow>>;
  findById: (id: string) => Promise<Result<ConversationRow>>;
  findByUserId: (userId: string, options: FindOptions) => Promise<Result<{ rows: ConversationRow[]; totalCount: number }>>;
};

// Repository implementation
export function createConversationRepository(db: SQLiteDatabase): ConversationRepository {
  return {
    create: async (data) => {
      // Tinqer insert implementation
    },
    findById: async (id) => {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("conversation")
            .where((c) => c.id === p.id)
            .select((c) => ({ ...c }))
            .take(1),
        { id }
      );

      return rows.length > 0
        ? { success: true, data: rows[0] as unknown as ConversationRow }
        : { success: false, error: new Error("Conversation not found") };
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

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  metadata: string | null;
  reply_to: string | null;
  created_at: string;
};

// Use interface only for extensible contracts or declaration merging
```

#### Strict Equality Only

**CRITICAL**: Always use strict equality operators (`===` and `!==`). Never use loose equality (`==` or `!=`).

```typescript
// Good - Strict equality
if (value === null) { ... }
if (value !== undefined) { ... }
if (conversation !== null && conversation !== undefined) { ... }

// Bad - Loose equality (BANNED)
if (value == null) { ... }
if (value != undefined) { ... }
```

#### Avoid `any`

Never use `any`. Use `unknown` if type is truly unknown:

```typescript
// Good
function parseJSON(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Bad
function parseJSON(content: any): any {
  return JSON.parse(content);
}
```

### 7. Async/Await Pattern

Always use async/await instead of promises:

```typescript
// Good
export async function getConversationMessages(
  repos: Repositories,
  conversationId: string,
): Promise<Result<MessageRow[]>> {
  const convResult = await repos.conversations.findById(conversationId);
  if (!convResult.success) {
    return convResult;
  }

  const messagesResult = await repos.messages.findByConversationId(conversationId);
  return messagesResult;
}

// Bad - Promise chains
export function getConversationMessages(
  repos: Repositories,
  conversationId: string,
): Promise<Result<MessageRow[]>> {
  return repos.conversations.findById(conversationId).then((convResult) => {
    if (!convResult.success) {
      return convResult;
    }
    return repos.messages.findByConversationId(conversationId);
  });
}
```

### 8. GraphQL Resolver Patterns

```typescript
// Good - Proper error handling with Result types
export const conversationResolvers = {
  Query: {
    conversation: async (_parent: unknown, args: { id: string }, context: Context) => {
      const result = await context.repos.conversations.findById(args.id);

      if (!result.success) {
        throw new GraphQLError(result.error.message);
      }

      // Verify caller is a participant
      const participant = await context.repos.conversations.findParticipant(args.id, context.userId);
      if (participant === null) {
        throw new GraphQLError("Not a participant");
      }

      return result.data;
    },
  },
  Mutation: {
    sendMessage: async (
      _parent: unknown,
      args: { input: SendMessageInput },
      context: Context,
    ) => {
      const result = await context.repos.messages.create(args.input);

      if (!result.success) {
        throw new GraphQLError(result.error.message);
      }

      return result.data;
    },
  },
};
```

### 9. Documentation

Add JSDoc comments for exported functions:

```typescript
/**
 * Creates a new conversation with the specified participants.
 *
 * @param repos - Repository instances
 * @param data - Conversation creation data including participants
 * @returns Result containing the created conversation or an error
 */
export async function createConversation(
  repos: Repositories,
  data: CreateConversationData,
): Promise<Result<ConversationRow>> {
  // Implementation
}
```

### 10. Testing

```typescript
describe("Conversation Repository", () => {
  let db: SQLiteDatabase;
  let conversationRepo: ConversationRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    const repos = createRepositories(db);
    conversationRepo = repos.conversations;
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  it("should create a conversation", async () => {
    // Arrange
    const data = {
      createdBy: "user-abc123",
      title: "Test Conversation",
      contextType: null,
      contextId: null,
    };

    // Act
    const result = await conversationRepo.create(data);

    // Assert
    expect(result.success).to.be.true;
    if (result.success) {
      expect(result.data.title).to.equal("Test Conversation");
      expect(result.data.created_by).to.equal("user-abc123");
    }
  });
});
```

### 11. Security Patterns

#### Input Validation

Always validate input at system boundaries:

```typescript
// Good - Validate before processing
router.post("/internal/conversations", async (req, res) => {
  const { participantIds, contextType } = req.body;

  if (!Array.isArray(participantIds) || participantIds.length < 1) {
    res.status(400).json({ error: "Invalid participantIds" });
    return;
  }

  if (contextType !== undefined && typeof contextType !== "string") {
    res.status(400).json({ error: "Invalid contextType" });
    return;
  }

  // Process validated input
});
```

#### Authentication & Authorization

```typescript
// Internal API authentication middleware
export function createInternalAuthMiddleware(internalSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader !== `Bearer ${internalSecret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  };
}
```

### 12. Logging

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

- [ ] All functions use Result types for error handling
- [ ] No classes used
- [ ] All imports include `.js` extension
- [ ] All database queries use Tinqer (no raw SQL unless necessary)
- [ ] Repository pattern implemented for data access
- [ ] JSDoc comments for public functions
- [ ] Input validation for all endpoints
- [ ] No `any` types used
- [ ] Strict equality only (`===`/`!==`, never `==`/`!=`)
- [ ] Tests included for new functionality
- [ ] No console.log statements (use logger)
- [ ] Environment variables validated at startup

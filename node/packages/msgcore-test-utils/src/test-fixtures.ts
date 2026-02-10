/**
 * Common test fixtures for MsgCore tests
 */

import { randomBytes } from "crypto";

// Generate a random alphanumeric ID of given length
export function generateId(length = 16): string {
  return randomBytes(length).toString("hex").substring(0, length);
}

// Create a test conversation fixture
export function createTestConversation(overrides?: {
  id?: string;
  contextType?: string | null;
  contextId?: string | null;
  title?: string | null;
  createdBy?: string;
}): {
  id: string;
  contextType: string | null;
  contextId: string | null;
  title: string | null;
  createdBy: string;
} {
  const id = overrides?.id ?? generateId();

  return {
    id,
    contextType: overrides?.contextType ?? null,
    contextId: overrides?.contextId ?? null,
    title: overrides?.title ?? null,
    createdBy: overrides?.createdBy ?? `user-${generateId(8)}`,
  };
}

// Create a test message fixture
export function createTestMessage(overrides?: {
  id?: string;
  conversationId?: string;
  senderId?: string;
  body?: string;
  metadata?: string | null;
  replyTo?: string | null;
}): {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  metadata: string | null;
  replyTo: string | null;
} {
  return {
    id: overrides?.id ?? generateId(),
    conversationId: overrides?.conversationId ?? generateId(),
    senderId: overrides?.senderId ?? `user-${generateId(8)}`,
    body: overrides?.body ?? "Test message body",
    metadata: overrides?.metadata ?? null,
    replyTo: overrides?.replyTo ?? null,
  };
}

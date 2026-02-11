export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function failure<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

export type MsgCoreConfig = {
  /** Base URL of the MsgCore service (e.g., "http://localhost:5007") */
  endpoint: string;
  /** Secret for X-Internal-Secret header */
  internalSecret: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Optional logger for debugging */
  logger?: Logger;
};

export type ConversationParticipant = {
  userId: string;
  displayName: string | null;
  lastSeenAt: string | null;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  metadata: string | null;
  replyTo: string | null;
  isDeleted: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  contextType: string | null;
  contextId: string | null;
  title: string | null;
  createdBy: string;
  lastMessageAt: string;
  createdAt: string;
  participants: ConversationParticipant[];
  messages: Message[];
  hasUnread: boolean;
};

export type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ConversationConnection = {
  nodes: Conversation[];
  totalCount: number;
  pageInfo: PageInfo;
};

export type ActivityCounts = {
  newConversationCount: number;
};

export type CreateConversationInput = {
  participantIds: string[];
  createdBy: string;
  contextType?: string;
  contextId?: string;
  title?: string;
  displayNames?: { userId: string; displayName: string }[];
};

export type SendMessageInput = {
  conversationId: string;
  senderId: string;
  body: string;
  metadata?: string;
  replyTo?: string;
};


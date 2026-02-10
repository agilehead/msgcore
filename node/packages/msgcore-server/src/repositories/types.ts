import type {
  ConversationRow,
  ConversationParticipantRow,
  MessageRow,
  UserActivityRow,
} from "@agilehead/msgcore-db";

export type CreateConversationData = {
  id: string;
  contextType: string | null;
  contextId: string | null;
  title: string | null;
  createdBy: string;
  participants: { userId: string; displayName: string | null }[];
};

export type FindConversationsOptions = {
  contextType?: string | null;
  search?: string | null;
  limit: number;
  offset: number;
};

export type ConversationRepository = {
  create(data: CreateConversationData): ConversationRow;
  findById(id: string): ConversationRow | null;
  findByContext(contextType: string, contextId: string): ConversationRow[];
  findByContextAndParticipants(
    contextType: string,
    contextId: string,
    participantIds: string[],
  ): ConversationRow | null;
  findByUserId(
    userId: string,
    options: FindConversationsOptions,
  ): { rows: ConversationRow[]; totalCount: number };
  findParticipants(conversationId: string): ConversationParticipantRow[];
  findParticipant(
    conversationId: string,
    userId: string,
  ): ConversationParticipantRow | null;
  updateLastMessageAt(id: string, timestamp: string): void;
  updateParticipantLastSeen(
    conversationId: string,
    userId: string,
    timestamp: string,
  ): void;
};

export type CreateMessageData = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  metadata: string | null;
  replyTo: string | null;
};

export type MessageRepository = {
  create(data: CreateMessageData): MessageRow;
  findById(id: string): MessageRow | null;
  findByConversationId(conversationId: string): MessageRow[];
  markDeleted(id: string, reason: string | null): void;
  anonymizeByUserId(userId: string): void;
};

export type UserActivityRepository = {
  findByUserId(userId: string): UserActivityRow | null;
  upsert(userId: string, lastSeenAt: string): void;
  countNewConversations(userId: string): number;
};

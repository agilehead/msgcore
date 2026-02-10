/**
 * SQLite-specific database row types for msgcore-db
 * These map directly to database tables with SQLite-specific types
 */

// Conversation table row
export type ConversationRow = {
  id: string;
  context_type: string | null;
  context_id: string | null;
  title: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
};

// Conversation participant table row
export type ConversationParticipantRow = {
  conversation_id: string;
  user_id: string;
  display_name: string | null;
  last_seen_at: string | null;
};

// Message table row
export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  metadata: string | null;
  reply_to: string | null;
  is_deleted: number;
  deleted_reason: string | null;
  created_at: string;
};

// User activity table row
export type UserActivityRow = {
  user_id: string;
  last_seen_at: string | null;
  updated_at: string;
};

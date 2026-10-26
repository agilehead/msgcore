// Database schema definition for Tinqer
// This provides type-safe queries with the Tinqer query builder

export type DatabaseSchema = {
  conversation: {
    id: string;
    context_type: string | null;
    context_id: string | null;
    title: string | null;
    created_by: string;
    last_message_at: string;
    created_at: string;
  };

  conversation_participant: {
    conversation_id: string;
    user_id: string;
    display_name: string | null;
    last_seen_at: string | null;
  };

  message: {
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

  user_activity: {
    user_id: string;
    last_seen_at: string | null;
    updated_at: string;
  };
};

import { executeSelect, executeInsert } from "@tinqerjs/better-sqlite3-adapter";
import {
  schema,
  type SQLiteDatabase,
  type MessageRow,
} from "@agilehead/msgcore-db";
import type { MessageRepository, CreateMessageData } from "../types.js";

export function createMessageRepository(db: SQLiteDatabase): MessageRepository {
  return {
    create(data: CreateMessageData): MessageRow {
      const now = new Date().toISOString();

      executeInsert(
        db,
        schema,
        (q, p) =>
          q.insertInto("message").values({
            id: p.id,
            conversation_id: p.conversationId,
            sender_id: p.senderId,
            body: p.body,
            metadata: p.metadata,
            reply_to: p.replyTo,
            is_deleted: 0,
            deleted_reason: null,
            created_at: p.now,
          }),
        {
          id: data.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          body: data.body,
          metadata: data.metadata,
          replyTo: data.replyTo,
          now,
        },
      );

      return {
        id: data.id,
        conversation_id: data.conversationId,
        sender_id: data.senderId,
        body: data.body,
        metadata: data.metadata,
        reply_to: data.replyTo,
        is_deleted: 0,
        deleted_reason: null,
        created_at: now,
      };
    },

    findById(id: string): MessageRow | null {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("message")
            .where((m) => m.id === p.id)
            .select((m) => ({
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              body: m.body,
              metadata: m.metadata,
              reply_to: m.reply_to,
              is_deleted: m.is_deleted,
              deleted_reason: m.deleted_reason,
              created_at: m.created_at,
            }))
            .take(1),
        { id },
      );

      return rows.length > 0 ? (rows[0] as unknown as MessageRow) : null;
    },

    findByConversationId(conversationId: string): MessageRow[] {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("message")
            .where((m) => m.conversation_id === p.conversationId)
            .select((m) => ({
              id: m.id,
              conversation_id: m.conversation_id,
              sender_id: m.sender_id,
              body: m.body,
              metadata: m.metadata,
              reply_to: m.reply_to,
              is_deleted: m.is_deleted,
              deleted_reason: m.deleted_reason,
              created_at: m.created_at,
            }))
            .orderBy((m) => m.created_at),
        { conversationId },
      );

      return rows as unknown as MessageRow[];
    },

    markDeleted(id: string, reason: string | null): void {
      db.prepare(
        "UPDATE message SET is_deleted = 1, deleted_reason = :reason, body = '[deleted]' WHERE id = :id",
      ).run({ id, reason });
    },

    anonymizeByUserId(userId: string): void {
      db.prepare(
        "UPDATE message SET body = '[anonymized]', metadata = NULL, sender_id = 'anonymous' WHERE sender_id = :userId",
      ).run({ userId });

      db.prepare(
        "UPDATE conversation_participant SET display_name = 'Anonymous' WHERE user_id = :userId",
      ).run({ userId });
    },
  };
}

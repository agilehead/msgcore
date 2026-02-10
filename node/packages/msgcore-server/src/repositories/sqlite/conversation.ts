import { executeSelect, executeInsert } from "@tinqerjs/better-sqlite3-adapter";
import {
  schema,
  type SQLiteDatabase,
  type ConversationRow,
  type ConversationParticipantRow,
} from "@agilehead/msgcore-db";
import type {
  ConversationRepository,
  CreateConversationData,
  FindConversationsOptions,
} from "../types.js";

export function createConversationRepository(
  db: SQLiteDatabase,
): ConversationRepository {
  return {
    create(data: CreateConversationData): ConversationRow {
      const now = new Date().toISOString();

      // Insert conversation
      executeInsert(
        db,
        schema,
        (q, p) =>
          q.insertInto("conversation").values({
            id: p.id,
            context_type: p.contextType,
            context_id: p.contextId,
            title: p.title,
            created_by: p.createdBy,
            last_message_at: p.now,
            created_at: p.now,
          }),
        {
          id: data.id,
          contextType: data.contextType,
          contextId: data.contextId,
          title: data.title,
          createdBy: data.createdBy,
          now,
        },
      );

      // Insert participants
      for (const participant of data.participants) {
        executeInsert(
          db,
          schema,
          (q, p) =>
            q.insertInto("conversation_participant").values({
              conversation_id: p.conversationId,
              user_id: p.userId,
              display_name: p.displayName,
              last_seen_at: null,
            }),
          {
            conversationId: data.id,
            userId: participant.userId,
            displayName: participant.displayName,
          },
        );
      }

      return {
        id: data.id,
        context_type: data.contextType,
        context_id: data.contextId,
        title: data.title,
        created_by: data.createdBy,
        last_message_at: now,
        created_at: now,
      };
    },

    findById(id: string): ConversationRow | null {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("conversation")
            .where((c) => c.id === p.id)
            .select((c) => ({
              id: c.id,
              context_type: c.context_type,
              context_id: c.context_id,
              title: c.title,
              created_by: c.created_by,
              last_message_at: c.last_message_at,
              created_at: c.created_at,
            }))
            .take(1),
        { id },
      );

      return rows.length > 0 ? (rows[0] as unknown as ConversationRow) : null;
    },

    findByContext(contextType: string, contextId: string): ConversationRow[] {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("conversation")
            .where(
              (c) =>
                c.context_type === p.contextType &&
                c.context_id === p.contextId,
            )
            .select((c) => ({
              id: c.id,
              context_type: c.context_type,
              context_id: c.context_id,
              title: c.title,
              created_by: c.created_by,
              last_message_at: c.last_message_at,
              created_at: c.created_at,
            })),
        { contextType, contextId },
      );

      return rows as unknown as ConversationRow[];
    },

    findByContextAndParticipants(
      contextType: string,
      contextId: string,
      participantIds: string[],
    ): ConversationRow | null {
      // Use raw SQL for complex join with multiple participant matching
      const placeholders = participantIds
        .map((_, i) => `:participant${String(i)}`)
        .join(", ");

      const params: Record<string, string | number> = {
        contextType,
        contextId,
        participantCount: participantIds.length,
      };
      for (let i = 0; i < participantIds.length; i++) {
        const pid = participantIds[i];
        if (pid !== undefined) {
          params[`participant${String(i)}`] = pid;
        }
      }

      const stmt = db.prepare(`
        SELECT c.id, c.context_type, c.context_id, c.title, c.created_by, c.last_message_at, c.created_at
        FROM conversation c
        WHERE c.context_type = :contextType
          AND c.context_id = :contextId
          AND (
            SELECT COUNT(*) FROM conversation_participant cp
            WHERE cp.conversation_id = c.id
            AND cp.user_id IN (${placeholders})
          ) = :participantCount
        LIMIT 1
      `);

      const row = stmt.get(params) as ConversationRow | undefined;
      return row ?? null;
    },

    findByUserId(
      userId: string,
      options: FindConversationsOptions,
    ): { rows: ConversationRow[]; totalCount: number } {
      // Use raw SQL for complex join with participant filtering and optional search
      const conditions: string[] = ["cp.user_id = :userId"];
      const params: Record<string, string | number> = {
        userId,
        limit: options.limit,
        offset: options.offset,
      };

      if (options.contextType !== undefined && options.contextType !== null) {
        conditions.push("c.context_type = :contextType");
        params.contextType = options.contextType;
      }

      if (
        options.search !== undefined &&
        options.search !== null &&
        options.search !== ""
      ) {
        conditions.push(
          "(c.title LIKE :search OR EXISTS (SELECT 1 FROM conversation_participant cp2 WHERE cp2.conversation_id = c.id AND cp2.display_name LIKE :search))",
        );
        params.search = `%${options.search}%`;
      }

      const whereClause = conditions.join(" AND ");

      const countStmt = db.prepare(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM conversation c
        JOIN conversation_participant cp ON cp.conversation_id = c.id
        WHERE ${whereClause}
      `);
      const countResult = countStmt.get(params) as { count: number };

      const rowsStmt = db.prepare(`
        SELECT DISTINCT c.id, c.context_type, c.context_id, c.title, c.created_by, c.last_message_at, c.created_at
        FROM conversation c
        JOIN conversation_participant cp ON cp.conversation_id = c.id
        WHERE ${whereClause}
        ORDER BY c.last_message_at DESC
        LIMIT :limit OFFSET :offset
      `);
      const rows = rowsStmt.all(params) as ConversationRow[];

      return { rows, totalCount: countResult.count };
    },

    findParticipants(conversationId: string): ConversationParticipantRow[] {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("conversation_participant")
            .where((cp) => cp.conversation_id === p.conversationId)
            .select((cp) => ({
              conversation_id: cp.conversation_id,
              user_id: cp.user_id,
              display_name: cp.display_name,
              last_seen_at: cp.last_seen_at,
            })),
        { conversationId },
      );

      return rows as unknown as ConversationParticipantRow[];
    },

    findParticipant(
      conversationId: string,
      userId: string,
    ): ConversationParticipantRow | null {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("conversation_participant")
            .where(
              (cp) =>
                cp.conversation_id === p.conversationId &&
                cp.user_id === p.userId,
            )
            .select((cp) => ({
              conversation_id: cp.conversation_id,
              user_id: cp.user_id,
              display_name: cp.display_name,
              last_seen_at: cp.last_seen_at,
            }))
            .take(1),
        { conversationId, userId },
      );

      return rows.length > 0
        ? (rows[0] as unknown as ConversationParticipantRow)
        : null;
    },

    updateLastMessageAt(id: string, timestamp: string): void {
      db.prepare(
        "UPDATE conversation SET last_message_at = :timestamp WHERE id = :id",
      ).run({ id, timestamp });
    },

    updateParticipantLastSeen(
      conversationId: string,
      userId: string,
      timestamp: string,
    ): void {
      db.prepare(
        "UPDATE conversation_participant SET last_seen_at = :timestamp WHERE conversation_id = :conversationId AND user_id = :userId",
      ).run({ conversationId, userId, timestamp });
    },
  };
}

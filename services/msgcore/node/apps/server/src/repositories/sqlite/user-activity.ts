import { executeSelect } from "@tinqerjs/better-sqlite3-adapter";
import {
  schema,
  type SQLiteDatabase,
  type UserActivityRow,
} from "@agilehead/msgcore-db";
import type { UserActivityRepository } from "../types.js";

export function createUserActivityRepository(
  db: SQLiteDatabase,
): UserActivityRepository {
  return {
    findByUserId(userId: string): UserActivityRow | null {
      const rows = executeSelect(
        db,
        schema,
        (q, p) =>
          q
            .from("user_activity")
            .where((ua) => ua.user_id === p.userId)
            .select((ua) => ({
              user_id: ua.user_id,
              last_seen_at: ua.last_seen_at,
              updated_at: ua.updated_at,
            }))
            .take(1),
        { userId },
      );

      return rows.length > 0 ? (rows[0] as unknown as UserActivityRow) : null;
    },

    upsert(userId: string, lastSeenAt: string): void {
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO user_activity (user_id, last_seen_at, updated_at)
         VALUES (:userId, :lastSeenAt, :now)
         ON CONFLICT(user_id) DO UPDATE SET
           last_seen_at = :lastSeenAt,
           updated_at = :now`,
      ).run({ userId, lastSeenAt, now });
    },

    countNewConversations(userId: string): number {
      // Count conversations where user is a participant and
      // the conversation has messages newer than user_activity.last_seen_at
      const result = db
        .prepare(
          `SELECT COUNT(DISTINCT c.id) as count
           FROM conversation c
           JOIN conversation_participant cp ON cp.conversation_id = c.id
           LEFT JOIN user_activity ua ON ua.user_id = :userId
           WHERE cp.user_id = :userId
             AND (ua.last_seen_at IS NULL OR c.last_message_at > ua.last_seen_at)`,
        )
        .get({ userId }) as { count: number };

      return result.count;
    },
  };
}

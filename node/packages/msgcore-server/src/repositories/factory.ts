import type { SQLiteDatabase } from "@agilehead/msgcore-db";
import type { Repositories } from "../context/index.js";
import { createConversationRepository } from "./sqlite/conversation.js";
import { createMessageRepository } from "./sqlite/message.js";
import { createUserActivityRepository } from "./sqlite/user-activity.js";

export function createRepositories(db: SQLiteDatabase): Repositories {
  return {
    conversations: createConversationRepository(db),
    messages: createMessageRepository(db),
    userActivity: createUserActivityRepository(db),
  };
}

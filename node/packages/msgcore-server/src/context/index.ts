import type { Request } from "express";
import type { ConversationRepository } from "../repositories/types.js";
import type { MessageRepository } from "../repositories/types.js";
import type { UserActivityRepository } from "../repositories/types.js";
import { verifyAccessToken } from "../auth/jwt.js";
import { createLogger } from "@agilehead/msgcore-logger";

const logger = createLogger("msgcore-context");

export type Repositories = {
  conversations: ConversationRepository;
  messages: MessageRepository;
  userActivity: UserActivityRepository;
};

export type Context = {
  repos: Repositories;
  userId: string | null;
};

export function createContext(
  repos: Repositories,
  jwtSecret: string,
  req: Request,
): Context {
  let userId: string | null = null;

  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token, jwtSecret);
    if (payload !== null) {
      userId = payload.userId;
    }
  }

  // Try cookie fallback
  if (userId === null) {
    const cookieHeader = req.headers.cookie;
    if (typeof cookieHeader === "string") {
      const tokenMatch = /access_token=([^;]+)/.exec(cookieHeader);
      if (tokenMatch?.[1] !== undefined) {
        const payload = verifyAccessToken(tokenMatch[1], jwtSecret);
        if (payload !== null) {
          userId = payload.userId;
        }
      }
    }
  }

  if (userId !== null) {
    logger.debug("Authenticated user", { userId });
  }

  return { repos, userId };
}

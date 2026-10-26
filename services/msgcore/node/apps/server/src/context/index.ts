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
  tenant: string | null;
};

export function createContext(
  repos: Repositories,
  jwtSecret: string,
  req: Request,
): Context {
  let userId: string | null = null;
  let tenant: string | null = null;

  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token, jwtSecret);
    if (payload !== null) {
      userId = payload.userId;
      tenant = payload.tenant ?? null;
    }
  }

  // Try cookie fallback (requires cookie-parser middleware)
  if (userId === null) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const accessToken = cookies?.access_token;
    if (typeof accessToken === "string" && accessToken !== "") {
      const payload = verifyAccessToken(accessToken, jwtSecret);
      if (payload !== null) {
        userId = payload.userId;
        tenant = payload.tenant ?? null;
      }
    }
  }

  if (userId !== null) {
    logger.debug("Authenticated user", { userId, tenant });
  }

  return { repos, userId, tenant };
}

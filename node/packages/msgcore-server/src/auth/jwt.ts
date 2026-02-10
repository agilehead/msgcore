import jwt from "jsonwebtoken";
import { createLogger } from "@agilehead/msgcore-logger";

const logger = createLogger("msgcore-auth");

export type JwtPayload = {
  userId: string;
  roles?: string[];
  tenant?: string;
};

export function verifyAccessToken(
  token: string,
  secret: string,
): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;

    const userId =
      typeof decoded.sub === "string"
        ? decoded.sub
        : typeof decoded.userId === "string"
          ? decoded.userId
          : null;

    if (userId === null) {
      logger.warn("JWT missing userId/sub claim");
      return null;
    }

    const roles = Array.isArray(decoded.roles)
      ? (decoded.roles as string[])
      : undefined;

    const tenant =
      typeof decoded.tenant === "string" ? decoded.tenant : undefined;

    return { userId, roles, tenant };
  } catch (error) {
    logger.debug("JWT verification failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

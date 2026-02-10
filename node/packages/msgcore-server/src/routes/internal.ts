/**
 * Internal Routes
 * Authenticated endpoints for service-to-service operations.
 * Protected by MSGCORE_INTERNAL_SECRET via X-Internal-Secret header.
 */

import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes } from "crypto";
import { createLogger } from "@agilehead/msgcore-logger";
import type { Repositories } from "../context/index.js";

const logger = createLogger("msgcore-internal");

function generateId(): string {
  return randomBytes(8).toString("hex");
}

export function createInternalRoutes(
  internalSecret: string,
  repos: Repositories,
): Router {
  const router = Router();

  // Authenticate all internal routes with MSGCORE_INTERNAL_SECRET
  router.use((req: Request, res: Response, next: NextFunction) => {
    const secret = req.headers["x-internal-secret"];
    if (secret !== internalSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });

  // Create conversation on behalf of users
  router.post("/conversation", (req: Request, res: Response) => {
    try {
      const body = req.body as {
        participantIds: string[];
        contextType?: string;
        contextId?: string;
        title?: string;
        createdBy: string;
        displayNames?: { userId: string; displayName: string }[];
      };

      if (
        !Array.isArray(body.participantIds) ||
        body.participantIds.length === 0
      ) {
        res.status(400).json({ error: "participantIds is required" });
        return;
      }

      if (typeof body.createdBy !== "string" || body.createdBy === "") {
        res.status(400).json({ error: "createdBy is required" });
        return;
      }

      const allParticipantIds = new Set(body.participantIds);
      allParticipantIds.add(body.createdBy);
      const participantIds = [...allParticipantIds].sort();

      // Idempotent check
      if (body.contextType !== undefined && body.contextId !== undefined) {
        const existing = repos.conversations.findByContextAndParticipants(
          body.contextType,
          body.contextId,
          participantIds,
        );
        if (existing !== null) {
          res.json(existing);
          return;
        }
      }

      const displayNameMap = new Map<string, string>();
      if (body.displayNames !== undefined) {
        for (const dn of body.displayNames) {
          displayNameMap.set(dn.userId, dn.displayName);
        }
      }

      const participants = participantIds.map((pid) => ({
        userId: pid,
        displayName: displayNameMap.get(pid) ?? null,
      }));

      const conv = repos.conversations.create({
        id: generateId(),
        contextType: body.contextType ?? null,
        contextId: body.contextId ?? null,
        title: body.title ?? null,
        createdBy: body.createdBy,
        participants,
      });

      logger.info("Internal: conversation created", {
        conversationId: conv.id,
      });

      res.status(201).json(conv);
    } catch (err: unknown) {
      logger.error("Internal: create conversation failed", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Send message on behalf of a user
  router.post("/message", (req: Request, res: Response) => {
    try {
      const body = req.body as {
        conversationId: string;
        senderId: string;
        body: string;
        metadata?: string;
        replyTo?: string;
      };

      if (
        typeof body.conversationId !== "string" ||
        body.conversationId === ""
      ) {
        res.status(400).json({ error: "conversationId is required" });
        return;
      }

      if (typeof body.senderId !== "string" || body.senderId === "") {
        res.status(400).json({ error: "senderId is required" });
        return;
      }

      if (typeof body.body !== "string" || body.body === "") {
        res.status(400).json({ error: "body is required" });
        return;
      }

      // Verify conversation exists
      const conv = repos.conversations.findById(body.conversationId);
      if (conv === null) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const message = repos.messages.create({
        id: generateId(),
        conversationId: body.conversationId,
        senderId: body.senderId,
        body: body.body,
        metadata: body.metadata ?? null,
        replyTo: body.replyTo ?? null,
      });

      // Update conversation's last_message_at
      repos.conversations.updateLastMessageAt(
        body.conversationId,
        message.created_at,
      );

      logger.info("Internal: message sent", {
        messageId: message.id,
        conversationId: body.conversationId,
      });

      res.status(201).json(message);
    } catch (err: unknown) {
      logger.error("Internal: send message failed", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Delete message with reason (moderation)
  router.delete("/message/:id", (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const messageId = typeof rawId === "string" ? rawId : undefined;
      if (messageId === undefined || messageId === "") {
        res.status(400).json({ error: "Message ID is required" });
        return;
      }

      const message = repos.messages.findById(messageId);
      if (message === null) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const body = req.body as { reason?: string } | undefined;
      const reason =
        body !== undefined && typeof body.reason === "string"
          ? body.reason
          : null;

      repos.messages.markDeleted(messageId, reason);

      logger.info("Internal: message deleted", { messageId, reason });

      res.json({ success: true });
    } catch (err: unknown) {
      logger.error("Internal: delete message failed", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Anonymize all user data
  router.post("/anonymize/:userId", (req: Request, res: Response) => {
    try {
      const rawUserId = req.params.userId;
      const userId = typeof rawUserId === "string" ? rawUserId : undefined;
      if (userId === undefined || userId === "") {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      repos.messages.anonymizeByUserId(userId);

      logger.info("Internal: user data anonymized", { userId });

      res.json({ success: true });
    } catch (err: unknown) {
      logger.error("Internal: anonymize failed", err);
      res.status(500).json({
        error: "Internal server error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}

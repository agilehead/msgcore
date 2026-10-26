import { GraphQLError } from "graphql";
import { randomBytes } from "crypto";
import { createLogger } from "@agilehead/msgcore-logger";
import type { GQLResolvers } from "../generated/graphql.js";

const logger = createLogger("msgcore-message-resolver");

function generateId(): string {
  return randomBytes(8).toString("hex");
}

function requireAuth(userId: string | null): string {
  if (userId === null) {
    throw new GraphQLError("Authentication required");
  }
  return userId;
}

export const messageResolvers: GQLResolvers = {
  Mutation: {
    sendMessage: (
      _parent,
      { conversationId, body, metadata, replyTo },
      context,
    ) => {
      const userId = requireAuth(context.userId);

      // Verify sender is a participant
      const participant = context.repos.conversations.findParticipant(
        conversationId,
        userId,
      );
      if (participant === null) {
        throw new GraphQLError("Not a participant in this conversation");
      }

      // Verify conversation exists
      const conv = context.repos.conversations.findById(conversationId);
      if (conv === null) {
        throw new GraphQLError("Conversation not found");
      }

      // Create the message
      const message = context.repos.messages.create({
        id: generateId(),
        conversationId,
        senderId: userId,
        body,
        metadata: metadata ?? null,
        replyTo: replyTo ?? null,
      });

      // Update conversation's last_message_at
      context.repos.conversations.updateLastMessageAt(
        conversationId,
        message.created_at,
      );

      logger.info("Message sent", {
        messageId: message.id,
        conversationId,
      });

      return {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        body: message.body,
        metadata: message.metadata,
        replyTo: message.reply_to,
        isDeleted: message.is_deleted === 1,
        createdAt: message.created_at,
      };
    },

    deleteMessage: (_parent, { messageId }, context) => {
      const userId = requireAuth(context.userId);

      const message = context.repos.messages.findById(messageId);
      if (message === null) {
        throw new GraphQLError("Message not found");
      }

      // Only sender can delete their own messages
      if (message.sender_id !== userId) {
        throw new GraphQLError("Only the sender can delete their message");
      }

      context.repos.messages.markDeleted(messageId, null);

      logger.info("Message deleted", { messageId });

      return true;
    },
  },
};

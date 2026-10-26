import { GraphQLError } from "graphql";
import { randomBytes } from "crypto";
import { createLogger } from "@agilehead/msgcore-logger";
import type { GQLResolvers } from "../generated/graphql.js";

const logger = createLogger("msgcore-conversation-resolver");

function generateId(): string {
  return randomBytes(8).toString("hex");
}

function requireAuth(userId: string | null): string {
  if (userId === null) {
    throw new GraphQLError("Authentication required");
  }
  return userId;
}

export const conversationResolvers: GQLResolvers = {
  Query: {
    conversation: (_parent, { id }, context) => {
      const userId = requireAuth(context.userId);

      const conv = context.repos.conversations.findById(id);
      if (conv === null) {
        return null;
      }

      // Verify caller is a participant
      const participant = context.repos.conversations.findParticipant(
        id,
        userId,
      );
      if (participant === null) {
        return null;
      }

      return {
        id: conv.id,
        contextType: conv.context_type,
        contextId: conv.context_id,
        title: conv.title,
        createdBy: conv.created_by,
        lastMessageAt: conv.last_message_at,
        createdAt: conv.created_at,
        participants: [],
        messages: [],
        hasUnread: false,
      };
    },

    conversationByContext: (
      _parent,
      { contextType, contextId, participantId },
      context,
    ) => {
      const userId = requireAuth(context.userId);

      // Find conversation where both caller and participantId are participants
      const participantIds = [userId, participantId].sort();
      const conv = context.repos.conversations.findByContextAndParticipants(
        contextType,
        contextId,
        participantIds,
      );

      if (conv === null) {
        return null;
      }

      // Verify caller is a participant
      const participant = context.repos.conversations.findParticipant(
        conv.id,
        userId,
      );
      if (participant === null) {
        return null;
      }

      return {
        id: conv.id,
        contextType: conv.context_type,
        contextId: conv.context_id,
        title: conv.title,
        createdBy: conv.created_by,
        lastMessageAt: conv.last_message_at,
        createdAt: conv.created_at,
        participants: [],
        messages: [],
        hasUnread: false,
      };
    },

    myConversations: (_parent, args, context) => {
      const userId = requireAuth(context.userId);

      const limit = args.limit ?? 20;
      const offset = args.offset ?? 0;

      const result = context.repos.conversations.findByUserId(userId, {
        contextType: args.contextType,
        search: args.search,
        limit,
        offset,
      });

      const nodes = result.rows.map((conv) => ({
        id: conv.id,
        contextType: conv.context_type,
        contextId: conv.context_id,
        title: conv.title,
        createdBy: conv.created_by,
        lastMessageAt: conv.last_message_at,
        createdAt: conv.created_at,
        participants: [],
        messages: [],
        hasUnread: false,
      }));

      return {
        nodes,
        totalCount: result.totalCount,
        pageInfo: {
          hasNextPage: offset + limit < result.totalCount,
          hasPreviousPage: offset > 0,
        },
      };
    },
  },

  Mutation: {
    createConversation: (_parent, { input }, context) => {
      const userId = requireAuth(context.userId);

      // Ensure creator is included in participants
      const allParticipantIds = new Set(input.participantIds);
      allParticipantIds.add(userId);
      const participantIds = [...allParticipantIds].sort();

      // Idempotent: if context + same participants exist, return existing
      if (
        input.contextType !== undefined &&
        input.contextType !== null &&
        input.contextId !== undefined &&
        input.contextId !== null
      ) {
        const existing =
          context.repos.conversations.findByContextAndParticipants(
            input.contextType,
            input.contextId,
            participantIds,
          );
        if (existing !== null) {
          logger.info("Returning existing conversation for context", {
            conversationId: existing.id,
            contextType: input.contextType,
            contextId: input.contextId,
          });
          return {
            id: existing.id,
            contextType: existing.context_type,
            contextId: existing.context_id,
            title: existing.title,
            createdBy: existing.created_by,
            lastMessageAt: existing.last_message_at,
            createdAt: existing.created_at,
            participants: [],
            messages: [],
            hasUnread: false,
          };
        }
      }

      // Build display name map
      const displayNameMap = new Map<string, string>();
      if (input.displayNames !== undefined && input.displayNames !== null) {
        for (const dn of input.displayNames) {
          displayNameMap.set(dn.userId, dn.displayName);
        }
      }

      const participants = participantIds.map((pid) => ({
        userId: pid,
        displayName: displayNameMap.get(pid) ?? null,
      }));

      const conv = context.repos.conversations.create({
        id: generateId(),
        contextType: input.contextType ?? null,
        contextId: input.contextId ?? null,
        title: input.title ?? null,
        createdBy: userId,
        participants,
      });

      logger.info("Conversation created", {
        conversationId: conv.id,
        participantCount: participants.length,
      });

      return {
        id: conv.id,
        contextType: conv.context_type,
        contextId: conv.context_id,
        title: conv.title,
        createdBy: conv.created_by,
        lastMessageAt: conv.last_message_at,
        createdAt: conv.created_at,
        participants: [],
        messages: [],
        hasUnread: false,
      };
    },

    markConversationSeen: (_parent, { conversationId }, context) => {
      const userId = requireAuth(context.userId);

      const participant = context.repos.conversations.findParticipant(
        conversationId,
        userId,
      );
      if (participant === null) {
        throw new GraphQLError("Not a participant in this conversation");
      }

      const now = new Date().toISOString();
      context.repos.conversations.updateParticipantLastSeen(
        conversationId,
        userId,
        now,
      );

      return true;
    },

    markAllSeen: (_parent, _args, context) => {
      const userId = requireAuth(context.userId);

      const now = new Date().toISOString();
      context.repos.userActivity.upsert(userId, now);

      return true;
    },
  },

  Conversation: {
    participants: (parent, _args, context) => {
      const rows = context.repos.conversations.findParticipants(parent.id);
      return rows.map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        lastSeenAt: row.last_seen_at,
      }));
    },

    messages: (parent, _args, context) => {
      const rows = context.repos.messages.findByConversationId(parent.id);
      return rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        body: row.body,
        metadata: row.metadata,
        replyTo: row.reply_to,
        isDeleted: row.is_deleted === 1,
        createdAt: row.created_at,
      }));
    },

    hasUnread: (parent, _args, context) => {
      if (context.userId === null) {
        return false;
      }
      const participant = context.repos.conversations.findParticipant(
        parent.id,
        context.userId,
      );
      if (participant === null) {
        return false;
      }
      if (participant.last_seen_at === null) {
        return true;
      }
      return parent.lastMessageAt > participant.last_seen_at;
    },
  },
};

import { graphqlRequest, internalRequest } from "./http-client.js";
import type {
  ActivityCounts,
  Conversation,
  ConversationConnection,
  CreateConversationInput,
  Logger,
  Message,
  MsgCoreConfig,
  Result,
  SendMessageInput,
} from "./types.js";
import { success, failure } from "./types.js";

export type MsgCoreClient = {
  // GraphQL reads (require user token)
  getConversation(
    id: string,
    token: string,
  ): Promise<Result<Conversation | null>>;
  getConversationByContext(
    contextType: string,
    contextId: string,
    participantId: string,
    token: string,
  ): Promise<Result<Conversation | null>>;
  getMyConversations(
    params: {
      contextType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
    token: string,
  ): Promise<Result<ConversationConnection>>;
  getActivityCounts(token: string): Promise<Result<ActivityCounts>>;

  // GraphQL mutations (require user token)
  markConversationSeen(
    conversationId: string,
    token: string,
  ): Promise<Result<boolean>>;
  markAllSeen(token: string): Promise<Result<boolean>>;
  deleteOwnMessage(
    messageId: string,
    token: string,
  ): Promise<Result<boolean>>;

  // Internal REST (use shared secret)
  getConversationInternal(
    id: string,
  ): Promise<Result<Conversation | null>>;
  createConversation(
    input: CreateConversationInput,
  ): Promise<Result<Conversation>>;
  sendMessage(input: SendMessageInput): Promise<Result<Message>>;
  deleteMessage(messageId: string, reason?: string): Promise<Result<void>>;
  anonymizeUser(userId: string): Promise<Result<void>>;
};

const CONVERSATION_FIELDS = `
  id
  contextType
  contextId
  title
  createdBy
  lastMessageAt
  createdAt
  participants {
    userId
    displayName
    lastSeenAt
  }
  messages {
    id
    conversationId
    senderId
    body
    metadata
    replyTo
    isDeleted
    createdAt
  }
  hasUnread
`;

export function createMsgCoreClient(config: MsgCoreConfig): MsgCoreClient {
  const { internalSecret, timeout, logger } = config;
  const base = config.endpoint.endsWith("/")
    ? config.endpoint.slice(0, -1)
    : config.endpoint;
  const graphqlUrl = `${base}/graphql`;

  return {
    async getConversation(
      id: string,
      token: string,
    ): Promise<Result<Conversation | null>> {
      const query = `
        query GetConversation($id: String!) {
          conversation(id: $id) {
            ${CONVERSATION_FIELDS}
          }
        }
      `;
      const result = await graphqlRequest<{
        conversation: Conversation | null;
      }>({
        endpoint: graphqlUrl,
        query,
        variables: { id },
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.conversation);
    },

    async getConversationByContext(
      contextType: string,
      contextId: string,
      participantId: string,
      token: string,
    ): Promise<Result<Conversation | null>> {
      const query = `
        query GetConversationByContext($contextType: String!, $contextId: String!, $participantId: String!) {
          conversationByContext(contextType: $contextType, contextId: $contextId, participantId: $participantId) {
            ${CONVERSATION_FIELDS}
          }
        }
      `;
      const result = await graphqlRequest<{
        conversationByContext: Conversation | null;
      }>({
        endpoint: graphqlUrl,
        query,
        variables: { contextType, contextId, participantId },
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.conversationByContext);
    },

    async getMyConversations(
      params: {
        contextType?: string;
        search?: string;
        limit?: number;
        offset?: number;
      },
      token: string,
    ): Promise<Result<ConversationConnection>> {
      const query = `
        query GetMyConversations($contextType: String, $search: String, $limit: Int, $offset: Int) {
          myConversations(contextType: $contextType, search: $search, limit: $limit, offset: $offset) {
            nodes {
              ${CONVERSATION_FIELDS}
            }
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `;
      const result = await graphqlRequest<{
        myConversations: ConversationConnection;
      }>({
        endpoint: graphqlUrl,
        query,
        variables: params,
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.myConversations);
    },

    async getActivityCounts(
      token: string,
    ): Promise<Result<ActivityCounts>> {
      const query = `
        query GetActivityCounts {
          activityCounts {
            newConversationCount
          }
        }
      `;
      const result = await graphqlRequest<{
        activityCounts: ActivityCounts;
      }>({
        endpoint: graphqlUrl,
        query,
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.activityCounts);
    },

    async markConversationSeen(
      conversationId: string,
      token: string,
    ): Promise<Result<boolean>> {
      const query = `
        mutation MarkConversationSeen($conversationId: String!) {
          markConversationSeen(conversationId: $conversationId)
        }
      `;
      const result = await graphqlRequest<{
        markConversationSeen: boolean;
      }>({
        endpoint: graphqlUrl,
        query,
        variables: { conversationId },
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.markConversationSeen);
    },

    async markAllSeen(token: string): Promise<Result<boolean>> {
      const query = `
        mutation MarkAllSeen {
          markAllSeen
        }
      `;
      const result = await graphqlRequest<{ markAllSeen: boolean }>({
        endpoint: graphqlUrl,
        query,
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.markAllSeen);
    },

    async deleteOwnMessage(
      messageId: string,
      token: string,
    ): Promise<Result<boolean>> {
      const query = `
        mutation DeleteMessage($messageId: String!) {
          deleteMessage(messageId: $messageId)
        }
      `;
      const result = await graphqlRequest<{ deleteMessage: boolean }>({
        endpoint: graphqlUrl,
        query,
        variables: { messageId },
        token,
        timeout,
        logger,
      });
      if (!result.success) {
        return result;
      }
      return success(result.data.deleteMessage);
    },

    async getConversationInternal(
      id: string,
    ): Promise<Result<Conversation | null>> {
      const result = await internalRequest<Conversation>({
        endpoint: base,
        method: "GET",
        path: `/internal/conversation/${id}`,
        secret: internalSecret,
        timeout,
        logger,
      });
      if (!result.success) {
        if (result.error.message.includes("404")) {
          return success(null);
        }
        return result;
      }
      return result;
    },

    async createConversation(
      input: CreateConversationInput,
    ): Promise<Result<Conversation>> {
      return internalRequest<Conversation>({
        endpoint: base,
        method: "POST",
        path: "/internal/conversation",
        secret: internalSecret,
        body: input,
        timeout,
        logger,
      });
    },

    async sendMessage(input: SendMessageInput): Promise<Result<Message>> {
      return internalRequest<Message>({
        endpoint: base,
        method: "POST",
        path: "/internal/message",
        secret: internalSecret,
        body: input,
        timeout,
        logger,
      });
    },

    async deleteMessage(
      messageId: string,
      reason?: string,
    ): Promise<Result<void>> {
      return internalRequest<void>({
        endpoint: base,
        method: "DELETE",
        path: `/internal/message/${messageId}`,
        secret: internalSecret,
        body: reason !== undefined ? { reason } : undefined,
        timeout,
        logger,
      });
    },

    async anonymizeUser(userId: string): Promise<Result<void>> {
      return internalRequest<void>({
        endpoint: base,
        method: "POST",
        path: `/internal/anonymize/${userId}`,
        secret: internalSecret,
        timeout,
        logger,
      });
    },
  };
}

export function createNoOpMsgCoreClient(logger?: Logger): MsgCoreClient {
  const warn = (method: string): void => {
    logger?.warn(
      `MsgCore service is not configured — ${method} is a no-op`,
    );
  };

  const notConfigured = (method: string): Promise<Result<never>> => {
    warn(method);
    return Promise.resolve(
      failure(new Error("MsgCore service is not configured")),
    );
  };

  return {
    getConversation(): Promise<Result<Conversation | null>> {
      warn("getConversation");
      return Promise.resolve(success(null));
    },

    getConversationByContext(): Promise<Result<Conversation | null>> {
      warn("getConversationByContext");
      return Promise.resolve(success(null));
    },

    getMyConversations(): Promise<Result<ConversationConnection>> {
      warn("getMyConversations");
      return Promise.resolve(
        success({
          nodes: [],
          totalCount: 0,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        }),
      );
    },

    getActivityCounts(): Promise<Result<ActivityCounts>> {
      warn("getActivityCounts");
      return Promise.resolve(success({ newConversationCount: 0 }));
    },

    markConversationSeen(): Promise<Result<boolean>> {
      warn("markConversationSeen");
      return Promise.resolve(success(true));
    },

    markAllSeen(): Promise<Result<boolean>> {
      warn("markAllSeen");
      return Promise.resolve(success(true));
    },

    deleteOwnMessage: (_messageId) => notConfigured("deleteOwnMessage"),

    getConversationInternal(): Promise<Result<Conversation | null>> {
      warn("getConversationInternal");
      return Promise.resolve(success(null));
    },

    createConversation: (_input) => notConfigured("createConversation"),

    sendMessage: (_input) => notConfigured("sendMessage"),

    deleteMessage: (_messageId) => notConfigured("deleteMessage"),

    anonymizeUser: (_userId) => notConfigured("anonymizeUser"),
  };
}

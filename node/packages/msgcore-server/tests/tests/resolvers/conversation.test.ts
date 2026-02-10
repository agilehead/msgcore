import { expect } from "chai";
import { graphqlUrl, truncateTables } from "../../setup.js";
import { createTestToken } from "../../helpers/auth.js";
import {
  CREATE_CONVERSATION,
  GET_CONVERSATION,
  GET_CONVERSATION_BY_CONTEXT,
  MY_CONVERSATIONS,
  MARK_CONVERSATION_SEEN,
  MARK_ALL_SEEN,
} from "../../graphql/operations/conversations.js";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

type ConversationType = {
  id: string;
  contextType: string | null;
  contextId: string | null;
  title: string | null;
  createdBy: string;
  lastMessageAt: string;
  createdAt: string;
  participants: { userId: string; displayName: string | null }[];
  messages: unknown[];
  hasUnread: boolean;
};

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
  token?: string,
): Promise<GraphQLResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  return (await response.json()) as GraphQLResponse<T>;
}

describe("Conversation Resolvers", () => {
  const userId1 = "user-test-001";
  const userId2 = "user-test-002";
  let token1: string;
  let token2: string;

  before(() => {
    token1 = createTestToken(userId1);
    token2 = createTestToken(userId2);
  });

  beforeEach(() => {
    truncateTables();
  });

  describe("createConversation", () => {
    it("should create a new conversation", async () => {
      const result = await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            title: "Test Conversation",
          },
        },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.createConversation).to.not.equal(undefined);
      expect(result.data?.createConversation.title).to.equal(
        "Test Conversation",
      );
      expect(result.data?.createConversation.createdBy).to.equal(userId1);
      expect(result.data?.createConversation.participants).to.have.length(2);
    });

    it("should create a contextual conversation", async () => {
      const result = await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            contextType: "item",
            contextId: "item-123",
            title: "About this item",
          },
        },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.createConversation.contextType).to.equal("item");
      expect(result.data?.createConversation.contextId).to.equal("item-123");
    });

    it("should return existing conversation for same context and participants (idempotent)", async () => {
      const result1 = await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            contextType: "item",
            contextId: "item-456",
          },
        },
        token1,
      );

      const result2 = await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            contextType: "item",
            contextId: "item-456",
          },
        },
        token1,
      );

      expect(result1.data?.createConversation.id).to.equal(
        result2.data?.createConversation.id,
      );
    });

    it("should reject unauthenticated requests", async () => {
      const result = await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
          },
        },
      );

      expect(result.errors).to.not.equal(undefined);
      expect(result.errors?.[0]?.message).to.include("Authentication required");
    });
  });

  describe("conversation query", () => {
    it("should return conversation for participant", async () => {
      const createResult = await graphql<{
        createConversation: ConversationType;
      }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            title: "Fetch Test",
          },
        },
        token1,
      );

      const convId = createResult.data?.createConversation.id;

      const result = await graphql<{ conversation: ConversationType }>(
        GET_CONVERSATION,
        { id: convId },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.conversation).to.not.equal(undefined);
      expect(result.data?.conversation.title).to.equal("Fetch Test");
    });

    it("should return null for non-participant", async () => {
      const createResult = await graphql<{
        createConversation: ConversationType;
      }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            title: "Private",
          },
        },
        token1,
      );

      const convId = createResult.data?.createConversation.id;
      const otherToken = createTestToken("user-outsider");

      const result = await graphql<{ conversation: ConversationType | null }>(
        GET_CONVERSATION,
        { id: convId },
        otherToken,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.conversation).to.equal(null);
    });
  });

  describe("conversationByContext", () => {
    it("should find conversation by context and participant", async () => {
      await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        {
          input: {
            participantIds: [userId2],
            contextType: "order",
            contextId: "order-789",
          },
        },
        token1,
      );

      const result = await graphql<{
        conversationByContext: ConversationType | null;
      }>(
        GET_CONVERSATION_BY_CONTEXT,
        {
          contextType: "order",
          contextId: "order-789",
          participantId: userId2,
        },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.conversationByContext).to.not.equal(null);
      expect(result.data?.conversationByContext?.contextType).to.equal("order");
    });
  });

  describe("myConversations", () => {
    it("should return all conversations for user", async () => {
      // Create two conversations
      await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        { input: { participantIds: [userId2], title: "Conv 1" } },
        token1,
      );

      await graphql<{ createConversation: ConversationType }>(
        CREATE_CONVERSATION,
        { input: { participantIds: [userId2], title: "Conv 2" } },
        token1,
      );

      const result = await graphql<{
        myConversations: {
          nodes: ConversationType[];
          totalCount: number;
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      }>(MY_CONVERSATIONS, {}, token1);

      expect(result.errors).to.equal(undefined);
      expect(result.data?.myConversations.totalCount).to.equal(2);
      expect(result.data?.myConversations.nodes).to.have.length(2);
    });

    it("should support pagination", async () => {
      await graphql(
        CREATE_CONVERSATION,
        { input: { participantIds: [userId2], title: "A" } },
        token1,
      );
      await graphql(
        CREATE_CONVERSATION,
        { input: { participantIds: [userId2], title: "B" } },
        token1,
      );
      await graphql(
        CREATE_CONVERSATION,
        { input: { participantIds: [userId2], title: "C" } },
        token1,
      );

      const result = await graphql<{
        myConversations: {
          nodes: ConversationType[];
          totalCount: number;
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      }>(MY_CONVERSATIONS, { limit: 2, offset: 0 }, token1);

      expect(result.data?.myConversations.nodes).to.have.length(2);
      expect(result.data?.myConversations.totalCount).to.equal(3);
      expect(result.data?.myConversations.pageInfo.hasNextPage).to.equal(true);
    });
  });

  describe("markConversationSeen", () => {
    it("should mark a conversation as seen", async () => {
      const createResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);

      const convId = createResult.data?.createConversation.id;

      const result = await graphql<{ markConversationSeen: boolean }>(
        MARK_CONVERSATION_SEEN,
        { conversationId: convId },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.markConversationSeen).to.equal(true);
    });
  });

  describe("markAllSeen", () => {
    it("should mark all conversations as seen", async () => {
      const result = await graphql<{ markAllSeen: boolean }>(
        MARK_ALL_SEEN,
        {},
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.markAllSeen).to.equal(true);
    });
  });
});

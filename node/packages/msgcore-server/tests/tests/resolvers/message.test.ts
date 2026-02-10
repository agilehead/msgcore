import { expect } from "chai";
import { graphqlUrl, truncateTables } from "../../setup.js";
import { createTestToken } from "../../helpers/auth.js";
import {
  CREATE_CONVERSATION,
  SEND_MESSAGE,
  DELETE_MESSAGE,
  GET_CONVERSATION,
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
  messages: MessageType[];
  hasUnread: boolean;
};

type MessageType = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  metadata: string | null;
  replyTo: string | null;
  isDeleted: boolean;
  createdAt: string;
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

describe("Message Resolvers", () => {
  const userId1 = "user-msg-001";
  const userId2 = "user-msg-002";
  let token1: string;
  let token2: string;

  before(() => {
    token1 = createTestToken(userId1);
    token2 = createTestToken(userId2);
  });

  beforeEach(() => {
    truncateTables();
  });

  describe("sendMessage", () => {
    it("should send a message to a conversation", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      const result = await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "Hello there!" },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.sendMessage).to.not.equal(undefined);
      expect(result.data?.sendMessage.body).to.equal("Hello there!");
      expect(result.data?.sendMessage.senderId).to.equal(userId1);
      expect(result.data?.sendMessage.conversationId).to.equal(convId);
    });

    it("should send a message with metadata", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      const metadata = JSON.stringify({ type: "offer", amount: 100 });
      const result = await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "I offer $100", metadata },
        token1,
      );

      expect(result.data?.sendMessage.metadata).to.equal(metadata);
    });

    it("should reject message from non-participant", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      const outsiderToken = createTestToken("user-outsider");
      const result = await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "Should fail" },
        outsiderToken,
      );

      expect(result.errors).to.not.equal(undefined);
      expect(result.errors?.[0]?.message).to.include("Not a participant");
    });

    it("should update conversation lastMessageAt after sending", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;
      const originalLastMessageAt =
        convResult.data?.createConversation.lastMessageAt;

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 50));

      await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "New message" },
        token1,
      );

      const getResult = await graphql<{ conversation: ConversationType }>(
        GET_CONVERSATION,
        { id: convId },
        token1,
      );

      expect(getResult.data?.conversation.lastMessageAt).to.not.equal(
        originalLastMessageAt,
      );
    });
  });

  describe("deleteMessage", () => {
    it("should allow sender to delete their message", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      const msgResult = await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "To be deleted" },
        token1,
      );
      const messageId = msgResult.data?.sendMessage.id;

      const result = await graphql<{ deleteMessage: boolean }>(
        DELETE_MESSAGE,
        { messageId },
        token1,
      );

      expect(result.errors).to.equal(undefined);
      expect(result.data?.deleteMessage).to.equal(true);
    });

    it("should reject deletion by non-sender", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      const msgResult = await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "Not yours to delete" },
        token1,
      );
      const messageId = msgResult.data?.sendMessage.id;

      const result = await graphql<{ deleteMessage: boolean }>(
        DELETE_MESSAGE,
        { messageId },
        token2,
      );

      expect(result.errors).to.not.equal(undefined);
      expect(result.errors?.[0]?.message).to.include("Only the sender");
    });
  });
});

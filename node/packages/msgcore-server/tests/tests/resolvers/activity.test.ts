import { expect } from "chai";
import { graphqlUrl, truncateTables } from "../../setup.js";
import { createTestToken } from "../../helpers/auth.js";
import {
  CREATE_CONVERSATION,
  SEND_MESSAGE,
  ACTIVITY_COUNTS,
  MARK_ALL_SEEN,
} from "../../graphql/operations/conversations.js";

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

type ConversationType = {
  id: string;
};

type MessageType = {
  id: string;
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

describe("Activity Resolvers", () => {
  const userId1 = "user-act-001";
  const userId2 = "user-act-002";
  let token1: string;
  let token2: string;

  before(() => {
    token1 = createTestToken(userId1);
    token2 = createTestToken(userId2);
  });

  beforeEach(() => {
    truncateTables();
  });

  describe("activityCounts", () => {
    it("should return new conversation count", async () => {
      // Create a conversation and send a message
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "Hello" },
        token1,
      );

      // User2 should see 1 new conversation
      const result = await graphql<{
        activityCounts: { newConversationCount: number };
      }>(ACTIVITY_COUNTS, {}, token2);

      expect(result.errors).to.equal(undefined);
      expect(
        result.data?.activityCounts.newConversationCount,
      ).to.be.greaterThan(0);
    });

    it("should reject unauthenticated requests", async () => {
      const result = await graphql<{
        activityCounts: { newConversationCount: number };
      }>(ACTIVITY_COUNTS, {});

      expect(result.errors).to.not.equal(undefined);
      expect(result.errors?.[0]?.message).to.include("Authentication required");
    });

    it("should return 0 after markAllSeen", async () => {
      const convResult = await graphql<{
        createConversation: ConversationType;
      }>(CREATE_CONVERSATION, { input: { participantIds: [userId2] } }, token1);
      const convId = convResult.data?.createConversation.id;

      await graphql<{ sendMessage: MessageType }>(
        SEND_MESSAGE,
        { conversationId: convId, body: "Hello" },
        token1,
      );

      // Mark all seen for user2
      await graphql<{ markAllSeen: boolean }>(MARK_ALL_SEEN, {}, token2);

      // Small delay to ensure timestamps differ
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now activity count should be 0
      const result = await graphql<{
        activityCounts: { newConversationCount: number };
      }>(ACTIVITY_COUNTS, {}, token2);

      expect(result.errors).to.equal(undefined);
      expect(result.data?.activityCounts.newConversationCount).to.equal(0);
    });
  });
});

import { expect } from "chai";
import {
  createMsgCoreClient,
  createNoOpMsgCoreClient,
} from "../client.js";
import type {
  Conversation,
  ConversationConnection,
  Message,
  MsgCoreClient,
} from "../types.js";

type FetchCall = { url: string; init: RequestInit };

let fetchCalls: FetchCall[] = [];
let fetchResponse: { status: number; body: unknown } = {
  status: 200,
  body: {},
};
const originalFetch = globalThis.fetch;

function mockFetch(): void {
  fetchCalls = [];
  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    fetchCalls.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(fetchResponse.body), {
      status: fetchResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

const TEST_ENDPOINT = "http://localhost:5007";
const TEST_SECRET = "test-internal-secret";
const TEST_TOKEN = "test-jwt-token";

const sampleConversation: Conversation = {
  id: "conv-1",
  contextType: "item",
  contextId: "item-123",
  title: "Discussion about item",
  createdBy: "user-1",
  lastMessageAt: "2025-01-01T00:00:00Z",
  createdAt: "2025-01-01T00:00:00Z",
  participants: [
    { userId: "user-1", displayName: "Alice", lastSeenAt: "2025-01-01T00:00:00Z" },
    { userId: "user-2", displayName: "Bob", lastSeenAt: null },
  ],
  messages: [
    {
      id: "msg-1",
      conversationId: "conv-1",
      senderId: "user-1",
      body: "Hello!",
      metadata: null,
      replyTo: null,
      isDeleted: false,
      createdAt: "2025-01-01T00:00:00Z",
    },
  ],
  hasUnread: false,
};

const sampleMessage: Message = {
  id: "msg-2",
  conversationId: "conv-1",
  senderId: "user-1",
  body: "New message",
  metadata: null,
  replyTo: null,
  isDeleted: false,
  createdAt: "2025-01-01T00:00:01Z",
};

function createTestClient(): MsgCoreClient {
  return createMsgCoreClient({
    endpoint: TEST_ENDPOINT,
    internalSecret: TEST_SECRET,
  });
}

describe("MsgCoreClient", () => {
  beforeEach(() => {
    mockFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  describe("GraphQL reads", () => {
    it("should fetch a conversation by id", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { conversation: sampleConversation } },
      };
      const client = createTestClient();
      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.deep.equal(sampleConversation);
      }

      expect(fetchCalls).to.have.length(1);
      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/graphql`);
      expect(call.init.method).to.equal("POST");

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).to.equal(`Bearer ${TEST_TOKEN}`);
      expect(headers["Content-Type"]).to.equal("application/json");

      const body = JSON.parse(call.init.body as string) as {
        query: string;
        variables: { id: string };
      };
      expect(body.variables.id).to.equal("conv-1");
      expect(body.query).to.include("conversation(id: $id)");
    });

    it("should return null for a non-existent conversation", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { conversation: null } },
      };
      const client = createTestClient();
      const result = await client.getConversation("non-existent", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.be.null;
      }
    });

    it("should fetch a conversation by context", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { conversationByContext: sampleConversation } },
      };
      const client = createTestClient();
      const result = await client.getConversationByContext(
        "item",
        "item-123",
        "user-1",
        TEST_TOKEN,
      );

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.deep.equal(sampleConversation);
      }

      const call = fetchCalls[0]!;
      const body = JSON.parse(call.init.body as string) as {
        query: string;
        variables: Record<string, string>;
      };
      expect(body.variables.contextType).to.equal("item");
      expect(body.variables.contextId).to.equal("item-123");
      expect(body.variables.participantId).to.equal("user-1");
      expect(body.query).to.include("conversationByContext(");
    });

    it("should fetch my conversations with pagination", async () => {
      const connection: ConversationConnection = {
        nodes: [sampleConversation],
        totalCount: 1,
        pageInfo: { hasNextPage: false, hasPreviousPage: false },
      };
      fetchResponse = {
        status: 200,
        body: { data: { myConversations: connection } },
      };
      const client = createTestClient();
      const result = await client.getMyConversations(
        { contextType: "item", limit: 10, offset: 0 },
        TEST_TOKEN,
      );

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.nodes).to.have.length(1);
        expect(result.data.totalCount).to.equal(1);
        expect(result.data.pageInfo.hasNextPage).to.equal(false);
      }

      const call = fetchCalls[0]!;
      const body = JSON.parse(call.init.body as string) as {
        variables: Record<string, unknown>;
      };
      expect(body.variables.contextType).to.equal("item");
      expect(body.variables.limit).to.equal(10);
      expect(body.variables.offset).to.equal(0);
    });

    it("should fetch activity counts", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { activityCounts: { newConversationCount: 5 } } },
      };
      const client = createTestClient();
      const result = await client.getActivityCounts(TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.newConversationCount).to.equal(5);
      }
    });
  });

  describe("GraphQL mutations", () => {
    it("should mark a conversation as seen", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { markConversationSeen: true } },
      };
      const client = createTestClient();
      const result = await client.markConversationSeen("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.equal(true);
      }

      const call = fetchCalls[0]!;
      const body = JSON.parse(call.init.body as string) as {
        query: string;
        variables: { conversationId: string };
      };
      expect(body.variables.conversationId).to.equal("conv-1");
      expect(body.query).to.include("markConversationSeen(");
    });

    it("should mark all conversations as seen", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { markAllSeen: true } },
      };
      const client = createTestClient();
      const result = await client.markAllSeen(TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.equal(true);
      }

      const call = fetchCalls[0]!;
      const body = JSON.parse(call.init.body as string) as { query: string };
      expect(body.query).to.include("markAllSeen");
    });

    it("should delete own message", async () => {
      fetchResponse = {
        status: 200,
        body: { data: { deleteMessage: true } },
      };
      const client = createTestClient();
      const result = await client.deleteOwnMessage("msg-1", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.equal(true);
      }

      const call = fetchCalls[0]!;
      const body = JSON.parse(call.init.body as string) as {
        query: string;
        variables: { messageId: string };
      };
      expect(body.variables.messageId).to.equal("msg-1");
      expect(body.query).to.include("deleteMessage(");
    });
  });

  describe("Internal REST", () => {
    it("should get a conversation by id via internal API", async () => {
      fetchResponse = {
        status: 200,
        body: sampleConversation,
      };
      const client = createTestClient();
      const result = await client.getConversationInternal("conv-1");

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.deep.equal(sampleConversation);
      }

      expect(fetchCalls).to.have.length(1);
      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/conversation/conv-1`);
      expect(call.init.method).to.equal("GET");

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).to.equal(`Bearer ${TEST_SECRET}`);
    });

    it("should return null for non-existent conversation via internal API", async () => {
      fetchResponse = {
        status: 404,
        body: { error: "Conversation not found" },
      };
      const client = createTestClient();
      const result = await client.getConversationInternal("non-existent");

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.be.null;
      }
    });

    it("should create a conversation", async () => {
      fetchResponse = {
        status: 200,
        body: sampleConversation,
      };
      const client = createTestClient();
      const result = await client.createConversation({
        participantIds: ["user-1", "user-2"],
        createdBy: "user-1",
        contextType: "item",
        contextId: "item-123",
        title: "Discussion about item",
        displayNames: [
          { userId: "user-1", displayName: "Alice" },
          { userId: "user-2", displayName: "Bob" },
        ],
      });

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.id).to.equal("conv-1");
      }

      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/conversation`);
      expect(call.init.method).to.equal("POST");

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).to.equal(`Bearer ${TEST_SECRET}`);
      expect(headers["Content-Type"]).to.equal("application/json");

      const body = JSON.parse(call.init.body as string) as {
        participantIds: string[];
        createdBy: string;
      };
      expect(body.participantIds).to.deep.equal(["user-1", "user-2"]);
      expect(body.createdBy).to.equal("user-1");
    });

    it("should send a message", async () => {
      fetchResponse = {
        status: 200,
        body: sampleMessage,
      };
      const client = createTestClient();
      const result = await client.sendMessage({
        conversationId: "conv-1",
        senderId: "user-1",
        body: "New message",
      });

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.id).to.equal("msg-2");
        expect(result.data.body).to.equal("New message");
      }

      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/message`);
      expect(call.init.method).to.equal("POST");
    });

    it("should delete a message with reason", async () => {
      fetchResponse = {
        status: 200,
        body: {},
      };
      const client = createTestClient();
      const result = await client.deleteMessage("msg-1", "Inappropriate content");

      expect(result.success).to.equal(true);

      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/message/msg-1`);
      expect(call.init.method).to.equal("DELETE");

      const body = JSON.parse(call.init.body as string) as { reason: string };
      expect(body.reason).to.equal("Inappropriate content");
    });

    it("should delete a message without reason", async () => {
      fetchResponse = {
        status: 200,
        body: {},
      };
      const client = createTestClient();
      const result = await client.deleteMessage("msg-1");

      expect(result.success).to.equal(true);

      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/message/msg-1`);
      expect(call.init.body).to.be.undefined;
    });

    it("should anonymize a user", async () => {
      fetchResponse = {
        status: 200,
        body: {},
      };
      const client = createTestClient();
      const result = await client.anonymizeUser("user-1");

      expect(result.success).to.equal(true);

      const call = fetchCalls[0]!;
      expect(call.url).to.equal(`${TEST_ENDPOINT}/internal/anonymize/user-1`);
      expect(call.init.method).to.equal("POST");

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Authorization"]).to.equal(`Bearer ${TEST_SECRET}`);
    });
  });

  describe("Error handling", () => {
    it("should handle HTTP errors from GraphQL endpoint", async () => {
      fetchResponse = {
        status: 500,
        body: "Internal Server Error",
      };
      const client = createTestClient();
      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("500");
      }
    });

    it("should handle GraphQL errors in response", async () => {
      fetchResponse = {
        status: 200,
        body: {
          errors: [{ message: "Not authorized" }],
          data: null,
        },
      };
      const client = createTestClient();
      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("Not authorized");
      }
    });

    it("should handle HTTP errors from internal REST endpoint", async () => {
      fetchResponse = {
        status: 403,
        body: "Forbidden",
      };
      const client = createTestClient();
      const result = await client.createConversation({
        participantIds: ["user-1"],
        createdBy: "user-1",
      });

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("403");
      }
    });

    it("should handle network errors", async () => {
      globalThis.fetch = async () => {
        throw new Error("Connection refused");
      };
      const client = createTestClient();
      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("Connection refused");
      }
    });

    it("should handle timeout errors", async () => {
      globalThis.fetch = async (
        _input: string | URL | Request,
        init?: RequestInit,
      ) => {
        // Simulate abort by checking the signal
        if (init?.signal) {
          await new Promise((_, reject) => {
            if (init.signal!.aborted) {
              reject(new DOMException("The operation was aborted.", "AbortError"));
              return;
            }
            init.signal!.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          });
        }
        return new Response("{}");
      };

      const client = createMsgCoreClient({
        endpoint: TEST_ENDPOINT,
        internalSecret: TEST_SECRET,
        timeout: 1,
      });

      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("timed out");
      }
    });

    it("should handle network errors on internal REST requests", async () => {
      globalThis.fetch = async () => {
        throw new Error("ECONNREFUSED");
      };
      const client = createTestClient();
      const result = await client.sendMessage({
        conversationId: "conv-1",
        senderId: "user-1",
        body: "test",
      });

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("ECONNREFUSED");
      }
    });
  });

  describe("No-op client", () => {
    it("should return null for getConversation", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.getConversation("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.be.null;
      }
    });

    it("should return null for getConversationInternal", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.getConversationInternal("conv-1");

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.be.null;
      }
    });

    it("should return null for getConversationByContext", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.getConversationByContext(
        "item",
        "item-123",
        "user-1",
        TEST_TOKEN,
      );

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.be.null;
      }
    });

    it("should return empty connection for getMyConversations", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.getMyConversations({}, TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.nodes).to.deep.equal([]);
        expect(result.data.totalCount).to.equal(0);
        expect(result.data.pageInfo.hasNextPage).to.equal(false);
        expect(result.data.pageInfo.hasPreviousPage).to.equal(false);
      }
    });

    it("should return zero activity counts", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.getActivityCounts(TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data.newConversationCount).to.equal(0);
      }
    });

    it("should return success for markConversationSeen", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.markConversationSeen("conv-1", TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.equal(true);
      }
    });

    it("should return success for markAllSeen", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.markAllSeen(TEST_TOKEN);

      expect(result.success).to.equal(true);
      if (result.success) {
        expect(result.data).to.equal(true);
      }
    });

    it("should return failure for deleteOwnMessage", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.deleteOwnMessage("msg-1", TEST_TOKEN);

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("not configured");
      }
    });

    it("should return failure for createConversation", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.createConversation({
        participantIds: ["user-1"],
        createdBy: "user-1",
      });

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("not configured");
      }
    });

    it("should return failure for sendMessage", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.sendMessage({
        conversationId: "conv-1",
        senderId: "user-1",
        body: "test",
      });

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("not configured");
      }
    });

    it("should return failure for deleteMessage", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.deleteMessage("msg-1");

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("not configured");
      }
    });

    it("should return failure for anonymizeUser", async () => {
      const client = createNoOpMsgCoreClient();
      const result = await client.anonymizeUser("user-1");

      expect(result.success).to.equal(false);
      if (!result.success) {
        expect(result.error.message).to.include("not configured");
      }
    });

    it("should log warnings when logger is provided", async () => {
      const warnings: unknown[][] = [];
      const logger = {
        debug: (..._args: unknown[]) => {},
        info: (..._args: unknown[]) => {},
        warn: (...args: unknown[]) => {
          warnings.push(args);
        },
        error: (..._args: unknown[]) => {},
      };

      const client = createNoOpMsgCoreClient(logger);
      await client.getConversation("conv-1", TEST_TOKEN);
      await client.createConversation({
        participantIds: ["user-1"],
        createdBy: "user-1",
      });

      expect(warnings).to.have.length(2);
      expect(warnings[0]![0]).to.include("getConversation");
      expect(warnings[1]![0]).to.include("createConversation");
    });
  });
});

import { expect } from "chai";
import { conversationRepo, truncateTables } from "../../setup.js";
import { generateId } from "@agilehead/msgcore-test-utils";

describe("Conversation Repository", () => {
  beforeEach(() => {
    truncateTables();
  });

  describe("create", () => {
    it("should create a conversation with participants", () => {
      const id = generateId();
      const conv = conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: "Test Conv",
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: "User One" },
          { userId: "user-2", displayName: "User Two" },
        ],
      });

      expect(conv.id).to.equal(id);
      expect(conv.title).to.equal("Test Conv");
      expect(conv.created_by).to.equal("user-1");
    });
  });

  describe("findById", () => {
    it("should find a conversation by ID", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: "Find Me",
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: null }],
      });

      const found = conversationRepo.findById(id);
      expect(found).to.not.equal(null);
      expect(found?.title).to.equal("Find Me");
    });

    it("should return null for non-existent ID", () => {
      const found = conversationRepo.findById("nonexistent");
      expect(found).to.equal(null);
    });
  });

  describe("findByContext", () => {
    it("should find conversations by context", () => {
      conversationRepo.create({
        id: generateId(),
        contextType: "item",
        contextId: "item-1",
        title: null,
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: null }],
      });

      const results = conversationRepo.findByContext("item", "item-1");
      expect(results).to.have.length(1);
    });
  });

  describe("findByUserId", () => {
    it("should find conversations for a user with pagination", () => {
      for (let i = 0; i < 5; i++) {
        conversationRepo.create({
          id: generateId(),
          contextType: null,
          contextId: null,
          title: `Conv ${String(i)}`,
          createdBy: "user-1",
          participants: [{ userId: "user-1", displayName: null }],
        });
      }

      const result = conversationRepo.findByUserId("user-1", {
        limit: 3,
        offset: 0,
      });

      expect(result.totalCount).to.equal(5);
      expect(result.rows).to.have.length(3);
    });
  });

  describe("findParticipants", () => {
    it("should return all participants for a conversation", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: "Alice" },
          { userId: "user-2", displayName: "Bob" },
        ],
      });

      const participants = conversationRepo.findParticipants(id);
      expect(participants).to.have.length(2);
    });
  });

  describe("findParticipant", () => {
    it("should find a specific participant", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: "Alice" }],
      });

      const participant = conversationRepo.findParticipant(id, "user-1");
      expect(participant).to.not.equal(null);
      expect(participant?.display_name).to.equal("Alice");
    });

    it("should return null for non-participant", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: null }],
      });

      const participant = conversationRepo.findParticipant(id, "user-other");
      expect(participant).to.equal(null);
    });
  });

  describe("findByContextAndParticipants", () => {
    it("should find conversation matching context and participants", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: "item",
        contextId: "item-99",
        title: null,
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: null },
          { userId: "user-2", displayName: null },
        ],
      });

      const found = conversationRepo.findByContextAndParticipants(
        "item",
        "item-99",
        ["user-1", "user-2"],
      );
      expect(found).to.not.equal(null);
      expect(found?.id).to.equal(id);
    });

    it("should return null when context does not exist", () => {
      const found = conversationRepo.findByContextAndParticipants(
        "nonexistent",
        "none",
        ["user-1"],
      );
      expect(found).to.equal(null);
    });

    it("should return null when participants do not match", () => {
      conversationRepo.create({
        id: generateId(),
        contextType: "item",
        contextId: "item-100",
        title: null,
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: null },
          { userId: "user-2", displayName: null },
        ],
      });

      // Search with different participant set
      const found = conversationRepo.findByContextAndParticipants(
        "item",
        "item-100",
        ["user-1", "user-3"],
      );
      expect(found).to.equal(null);
    });
  });

  describe("findByUserId with filters", () => {
    it("should filter by contextType", () => {
      conversationRepo.create({
        id: generateId(),
        contextType: "item",
        contextId: "item-1",
        title: null,
        createdBy: "user-filter",
        participants: [{ userId: "user-filter", displayName: null }],
      });
      conversationRepo.create({
        id: generateId(),
        contextType: "order",
        contextId: "order-1",
        title: null,
        createdBy: "user-filter",
        participants: [{ userId: "user-filter", displayName: null }],
      });

      const result = conversationRepo.findByUserId("user-filter", {
        contextType: "item",
        limit: 20,
        offset: 0,
      });
      expect(result.totalCount).to.equal(1);
      expect(result.rows).to.have.length(1);
    });

    it("should filter by search on title", () => {
      conversationRepo.create({
        id: generateId(),
        contextType: null,
        contextId: null,
        title: "About selling a bike",
        createdBy: "user-search",
        participants: [{ userId: "user-search", displayName: null }],
      });
      conversationRepo.create({
        id: generateId(),
        contextType: null,
        contextId: null,
        title: "Random chat",
        createdBy: "user-search",
        participants: [{ userId: "user-search", displayName: null }],
      });

      const result = conversationRepo.findByUserId("user-search", {
        search: "bike",
        limit: 20,
        offset: 0,
      });
      expect(result.totalCount).to.equal(1);
      expect(result.rows[0]?.title).to.equal("About selling a bike");
    });
  });

  describe("updateParticipantLastSeen", () => {
    it("should update the last_seen_at timestamp", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: null }],
      });

      const now = new Date().toISOString();
      conversationRepo.updateParticipantLastSeen(id, "user-1", now);

      const participant = conversationRepo.findParticipant(id, "user-1");
      expect(participant?.last_seen_at).to.equal(now);
    });
  });

  describe("updateLastMessageAt", () => {
    it("should update the last_message_at timestamp", () => {
      const id = generateId();
      conversationRepo.create({
        id,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [{ userId: "user-1", displayName: null }],
      });

      const newTimestamp = new Date().toISOString();
      conversationRepo.updateLastMessageAt(id, newTimestamp);

      const conv = conversationRepo.findById(id);
      expect(conv?.last_message_at).to.equal(newTimestamp);
    });
  });
});

import { expect } from "chai";
import {
  userActivityRepo,
  conversationRepo,
  messageRepo,
  truncateTables,
} from "../../setup.js";
import { generateId } from "@agilehead/msgcore-test-utils";

describe("User Activity Repository", () => {
  beforeEach(() => {
    truncateTables();
  });

  describe("findByUserId", () => {
    it("should return null for non-existent user", () => {
      const found = userActivityRepo.findByUserId("nonexistent");
      expect(found).to.equal(null);
    });

    it("should return activity after upsert", () => {
      const now = new Date().toISOString();
      userActivityRepo.upsert("user-1", now);

      const found = userActivityRepo.findByUserId("user-1");
      expect(found).to.not.equal(null);
      expect(found?.last_seen_at).to.equal(now);
    });
  });

  describe("upsert", () => {
    it("should create new activity record", () => {
      const now = new Date().toISOString();
      userActivityRepo.upsert("user-1", now);

      const found = userActivityRepo.findByUserId("user-1");
      expect(found?.user_id).to.equal("user-1");
      expect(found?.last_seen_at).to.equal(now);
    });

    it("should update existing activity record", () => {
      const time1 = "2026-01-01T00:00:00.000Z";
      const time2 = "2026-02-01T00:00:00.000Z";

      userActivityRepo.upsert("user-1", time1);
      userActivityRepo.upsert("user-1", time2);

      const found = userActivityRepo.findByUserId("user-1");
      expect(found?.last_seen_at).to.equal(time2);
    });
  });

  describe("countNewConversations", () => {
    it("should count conversations with new messages", () => {
      // Create a conversation and send a message
      const convId = generateId();
      conversationRepo.create({
        id: convId,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: null },
          { userId: "user-2", displayName: null },
        ],
      });

      messageRepo.create({
        id: generateId(),
        conversationId: convId,
        senderId: "user-1",
        body: "New message",
        metadata: null,
        replyTo: null,
      });

      // user-2 has no activity yet, so should see the new conversation
      const count = userActivityRepo.countNewConversations("user-2");
      expect(count).to.be.greaterThan(0);
    });

    it("should return 0 when all conversations are seen", () => {
      const convId = generateId();
      conversationRepo.create({
        id: convId,
        contextType: null,
        contextId: null,
        title: null,
        createdBy: "user-1",
        participants: [
          { userId: "user-1", displayName: null },
          { userId: "user-2", displayName: null },
        ],
      });

      // Mark all seen for user-2 with a future timestamp
      userActivityRepo.upsert("user-2", "2099-12-31T23:59:59.999Z");

      const count = userActivityRepo.countNewConversations("user-2");
      expect(count).to.equal(0);
    });
  });
});

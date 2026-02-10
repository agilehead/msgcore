import { expect } from "chai";
import { conversationRepo, messageRepo, truncateTables } from "../../setup.js";
import { generateId } from "@agilehead/msgcore-test-utils";

describe("Message Repository", () => {
  let conversationId: string;

  beforeEach(() => {
    truncateTables();

    // Create a conversation for message tests
    conversationId = generateId();
    conversationRepo.create({
      id: conversationId,
      contextType: null,
      contextId: null,
      title: "Message Test Conv",
      createdBy: "user-1",
      participants: [
        { userId: "user-1", displayName: null },
        { userId: "user-2", displayName: null },
      ],
    });
  });

  describe("create", () => {
    it("should create a message", () => {
      const id = generateId();
      const message = messageRepo.create({
        id,
        conversationId,
        senderId: "user-1",
        body: "Hello world",
        metadata: null,
        replyTo: null,
      });

      expect(message.id).to.equal(id);
      expect(message.body).to.equal("Hello world");
      expect(message.sender_id).to.equal("user-1");
      expect(message.is_deleted).to.equal(0);
    });

    it("should create a message with replyTo", () => {
      const originalId = generateId();
      messageRepo.create({
        id: originalId,
        conversationId,
        senderId: "user-1",
        body: "Original message",
        metadata: null,
        replyTo: null,
      });

      const replyId = generateId();
      const reply = messageRepo.create({
        id: replyId,
        conversationId,
        senderId: "user-2",
        body: "Reply to original",
        metadata: null,
        replyTo: originalId,
      });

      expect(reply.reply_to).to.equal(originalId);
      const found = messageRepo.findById(replyId);
      expect(found?.reply_to).to.equal(originalId);
    });

    it("should create a message with metadata", () => {
      const metadata = JSON.stringify({ type: "offer" });
      const message = messageRepo.create({
        id: generateId(),
        conversationId,
        senderId: "user-1",
        body: "With metadata",
        metadata,
        replyTo: null,
      });

      expect(message.metadata).to.equal(metadata);
    });
  });

  describe("findById", () => {
    it("should find a message by ID", () => {
      const id = generateId();
      messageRepo.create({
        id,
        conversationId,
        senderId: "user-1",
        body: "Find me",
        metadata: null,
        replyTo: null,
      });

      const found = messageRepo.findById(id);
      expect(found).to.not.equal(null);
      expect(found?.body).to.equal("Find me");
    });

    it("should return null for non-existent ID", () => {
      const found = messageRepo.findById("nonexistent");
      expect(found).to.equal(null);
    });
  });

  describe("findByConversationId", () => {
    it("should return messages in order", () => {
      messageRepo.create({
        id: generateId(),
        conversationId,
        senderId: "user-1",
        body: "First",
        metadata: null,
        replyTo: null,
      });

      messageRepo.create({
        id: generateId(),
        conversationId,
        senderId: "user-2",
        body: "Second",
        metadata: null,
        replyTo: null,
      });

      const messages = messageRepo.findByConversationId(conversationId);
      expect(messages).to.have.length(2);
    });
  });

  describe("markDeleted", () => {
    it("should mark a message as deleted", () => {
      const id = generateId();
      messageRepo.create({
        id,
        conversationId,
        senderId: "user-1",
        body: "To delete",
        metadata: null,
        replyTo: null,
      });

      messageRepo.markDeleted(id, "inappropriate");

      const found = messageRepo.findById(id);
      expect(found?.is_deleted).to.equal(1);
      expect(found?.body).to.equal("[deleted]");
      expect(found?.deleted_reason).to.equal("inappropriate");
    });
  });

  describe("anonymizeByUserId", () => {
    it("should anonymize all messages from a user", () => {
      const id1 = generateId();
      const id2 = generateId();

      messageRepo.create({
        id: id1,
        conversationId,
        senderId: "user-1",
        body: "My message",
        metadata: JSON.stringify({ private: true }),
        replyTo: null,
      });

      messageRepo.create({
        id: id2,
        conversationId,
        senderId: "user-2",
        body: "Other message",
        metadata: null,
        replyTo: null,
      });

      messageRepo.anonymizeByUserId("user-1");

      const msg1 = messageRepo.findById(id1);
      expect(msg1?.body).to.equal("[anonymized]");
      expect(msg1?.metadata).to.equal(null);
      expect(msg1?.sender_id).to.equal("anonymous");

      // user-2's message should be untouched
      const msg2 = messageRepo.findById(id2);
      expect(msg2?.body).to.equal("Other message");
    });
  });
});

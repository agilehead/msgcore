import { expect } from "chai";
import {
  serverBaseUrl,
  internalSecret,
  truncateTables,
  messageRepo,
} from "../../setup.js";

describe("Internal Routes", () => {
  beforeEach(() => {
    truncateTables();
  });

  describe("authentication", () => {
    it("should reject requests without auth header", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: ["user-1", "user-2"],
          createdBy: "user-1",
        }),
      });

      expect(response.status).to.equal(401);
    });

    it("should reject requests with wrong secret", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({
          participantIds: ["user-1", "user-2"],
          createdBy: "user-1",
        }),
      });

      expect(response.status).to.equal(401);
    });
  });

  describe("GET /internal/conversation/:id", () => {
    it("should return conversation with participants", async () => {
      // Create conversation first
      const createResponse = await fetch(
        `${serverBaseUrl}/internal/conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({
            participantIds: ["user-1", "user-2"],
            createdBy: "user-1",
            title: "Test Conv",
          }),
        },
      );
      const created = (await createResponse.json()) as { id: string };

      // Get conversation
      const response = await fetch(
        `${serverBaseUrl}/internal/conversation/${created.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${internalSecret}`,
          },
        },
      );

      expect(response.status).to.equal(200);
      const body = (await response.json()) as {
        id: string;
        title: string;
        createdBy: string;
        participants: { userId: string; displayName: string | null }[];
      };
      expect(body.id).to.equal(created.id);
      expect(body.title).to.equal("Test Conv");
      expect(body.createdBy).to.equal("user-1");
      expect(body.participants).to.be.an("array").with.lengthOf(2);
      const userIds = body.participants.map((p) => p.userId).sort();
      expect(userIds).to.deep.equal(["user-1", "user-2"]);
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await fetch(
        `${serverBaseUrl}/internal/conversation/nonexistent`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${internalSecret}`,
          },
        },
      );

      expect(response.status).to.equal(404);
    });
  });

  describe("POST /internal/conversation", () => {
    it("should create a conversation", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          participantIds: ["user-1", "user-2"],
          createdBy: "user-1",
          title: "Internal Conv",
        }),
      });

      expect(response.status).to.equal(201);
      const body = (await response.json()) as { id: string; title: string };
      expect(body.id).to.be.a("string");
      expect(body.title).to.equal("Internal Conv");
    });

    it("should return existing conversation for same context (idempotent)", async () => {
      const payload = {
        participantIds: ["user-1", "user-2"],
        createdBy: "user-1",
        contextType: "ticket",
        contextId: "ticket-1",
      };

      const response1 = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify(payload),
      });

      const body1 = (await response1.json()) as { id: string };

      const response2 = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify(payload),
      });

      const body2 = (await response2.json()) as { id: string };

      expect(body1.id).to.equal(body2.id);
    });
  });

  describe("POST /internal/message", () => {
    it("should send a message", async () => {
      // Create conversation first
      const convResponse = await fetch(
        `${serverBaseUrl}/internal/conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({
            participantIds: ["user-1", "user-2"],
            createdBy: "user-1",
          }),
        },
      );
      const conv = (await convResponse.json()) as { id: string };

      // Send message
      const response = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          senderId: "user-1",
          body: "Internal message",
        }),
      });

      expect(response.status).to.equal(201);
      const body = (await response.json()) as { id: string; body: string };
      expect(body.body).to.equal("Internal message");
    });
  });

  describe("DELETE /internal/message/:id", () => {
    it("should delete a message with reason", async () => {
      // Create conversation and message
      const convResponse = await fetch(
        `${serverBaseUrl}/internal/conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({
            participantIds: ["user-1"],
            createdBy: "user-1",
          }),
        },
      );
      const conv = (await convResponse.json()) as { id: string };

      const msgResponse = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          senderId: "user-1",
          body: "To be moderated",
        }),
      });
      const msg = (await msgResponse.json()) as { id: string };

      // Delete message
      const response = await fetch(
        `${serverBaseUrl}/internal/message/${msg.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({ reason: "Policy violation" }),
        },
      );

      expect(response.status).to.equal(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).to.equal(true);
    });
  });

  describe("POST /internal/conversation validation", () => {
    it("should reject empty participantIds", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          participantIds: [],
          createdBy: "user-1",
        }),
      });

      expect(response.status).to.equal(400);
    });

    it("should reject missing createdBy", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/conversation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          participantIds: ["user-1"],
        }),
      });

      expect(response.status).to.equal(400);
    });
  });

  describe("POST /internal/message validation", () => {
    it("should reject missing conversationId", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          senderId: "user-1",
          body: "test",
        }),
      });

      expect(response.status).to.equal(400);
    });

    it("should reject missing senderId", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: "fake",
          body: "test",
        }),
      });

      expect(response.status).to.equal(400);
    });

    it("should reject missing body", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: "fake",
          senderId: "user-1",
        }),
      });

      expect(response.status).to.equal(400);
    });

    it("should return 404 for non-existent conversation", async () => {
      const response = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: "nonexistent",
          senderId: "user-1",
          body: "test",
        }),
      });

      expect(response.status).to.equal(404);
    });
  });

  describe("DELETE /internal/message/:id errors", () => {
    it("should return 404 for non-existent message", async () => {
      const response = await fetch(
        `${serverBaseUrl}/internal/message/nonexistent`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
        },
      );

      expect(response.status).to.equal(404);
    });
  });

  describe("POST /internal/anonymize/:userId", () => {
    it("should anonymize user data and verify changes", async () => {
      // Create conversation and message
      const convResponse = await fetch(
        `${serverBaseUrl}/internal/conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
          body: JSON.stringify({
            participantIds: ["user-anon-1", "user-anon-2"],
            createdBy: "user-anon-1",
          }),
        },
      );
      const conv = (await convResponse.json()) as { id: string };

      const msgResponse = await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          senderId: "user-anon-1",
          body: "Personal data here",
          metadata: JSON.stringify({ private: true }),
        }),
      });
      const msg = (await msgResponse.json()) as { id: string };

      // Anonymize
      const response = await fetch(
        `${serverBaseUrl}/internal/anonymize/user-anon-1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${internalSecret}`,
          },
        },
      );

      expect(response.status).to.equal(200);
      const body = (await response.json()) as { success: boolean };
      expect(body.success).to.equal(true);

      // Verify the message was actually anonymized
      const anonymizedMsg = messageRepo.findById(msg.id);
      expect(anonymizedMsg?.body).to.equal("[anonymized]");
      expect(anonymizedMsg?.metadata).to.equal(null);
      expect(anonymizedMsg?.sender_id).to.equal("anonymous");
    });
  });
});

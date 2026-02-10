import { expect } from "chai";
import { serverBaseUrl, internalSecret, truncateTables } from "../../setup.js";

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

  describe("POST /internal/anonymize/:userId", () => {
    it("should anonymize user data", async () => {
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
            participantIds: ["user-1", "user-2"],
            createdBy: "user-1",
          }),
        },
      );
      const conv = (await convResponse.json()) as { id: string };

      await fetch(`${serverBaseUrl}/internal/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${internalSecret}`,
        },
        body: JSON.stringify({
          conversationId: conv.id,
          senderId: "user-1",
          body: "Personal data here",
        }),
      });

      // Anonymize
      const response = await fetch(
        `${serverBaseUrl}/internal/anonymize/user-1`,
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
    });
  });
});

import { expect } from "chai";
import jwt from "jsonwebtoken";
import { verifyAccessToken } from "../../../src/auth/jwt.js";

const TEST_SECRET = "test-secret-for-jwt-tests";

describe("JWT Auth", () => {
  describe("verifyAccessToken", () => {
    it("should extract userId from userId claim", () => {
      const token = jwt.sign(
        { sub: "identity-123", userId: "user-456" },
        TEST_SECRET,
      );
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result).to.not.equal(null);
      expect(result?.userId).to.equal("user-456");
    });

    it("should prefer userId over sub", () => {
      const token = jwt.sign(
        { sub: "identity-id", userId: "app-user-id" },
        TEST_SECRET,
      );
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.userId).to.equal("app-user-id");
    });

    it("should fall back to sub when userId is not present", () => {
      const token = jwt.sign({ sub: "fallback-id" }, TEST_SECRET);
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.userId).to.equal("fallback-id");
    });

    it("should return null when neither userId nor sub is present", () => {
      const token = jwt.sign({ email: "test@example.com" }, TEST_SECRET);
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result).to.equal(null);
    });

    it("should return null for expired token", () => {
      const token = jwt.sign({ userId: "user-1" }, TEST_SECRET, {
        expiresIn: "-1s",
      });
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result).to.equal(null);
    });

    it("should return null for token signed with wrong secret", () => {
      const token = jwt.sign({ userId: "user-1" }, "wrong-secret");
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result).to.equal(null);
    });

    it("should return null for malformed token", () => {
      const result = verifyAccessToken("not-a-valid-jwt", TEST_SECRET);

      expect(result).to.equal(null);
    });

    it("should extract roles array", () => {
      const token = jwt.sign(
        { userId: "user-1", roles: ["admin", "mod"] },
        TEST_SECRET,
      );
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.roles).to.deep.equal(["admin", "mod"]);
    });

    it("should extract tenant claim", () => {
      const token = jwt.sign(
        { userId: "user-1", tenant: "tenant-abc" },
        TEST_SECRET,
      );
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.tenant).to.equal("tenant-abc");
    });

    it("should return undefined roles when not present", () => {
      const token = jwt.sign({ userId: "user-1" }, TEST_SECRET);
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.roles).to.equal(undefined);
    });

    it("should return undefined tenant when not present", () => {
      const token = jwt.sign({ userId: "user-1" }, TEST_SECRET);
      const result = verifyAccessToken(token, TEST_SECRET);

      expect(result?.tenant).to.equal(undefined);
    });
  });
});

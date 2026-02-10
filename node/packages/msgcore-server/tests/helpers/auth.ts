import jwt from "jsonwebtoken";
import { jwtSecret } from "../setup.js";

export function createTestToken(userId: string): string {
  return jwt.sign({ sub: "identity-placeholder", userId }, jwtSecret, {
    expiresIn: "1h",
  });
}

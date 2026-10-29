import { dirname } from "node:path";

export const modes = ["single", "production"];
export const secret = "test-jwt-secret";
export const internalSecret = "test-internal-secret";

export function environment(port, database, mode) {
  return {
    NODE_ENV: mode === "production" ? "production" : "test",
    MSGCORE_SERVER_HOST: "127.0.0.1",
    MSGCORE_SERVER_PORT: String(port),
    MSGCORE_DATA_DIR: dirname(database.dbPath),
    MSGCORE_INTERNAL_SECRET: internalSecret,
    MSGCORE_JWT_SECRET: secret,
    MSGCORE_CORS_ORIGINS: "http://localhost:3000,http://localhost:3001",
    LOG_LEVEL: "error",
  };
}

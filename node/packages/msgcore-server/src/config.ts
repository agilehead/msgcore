import { join } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`ERROR: Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

function optional(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value !== undefined && value !== ""
    ? parseInt(value, 10)
    : defaultValue;
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

const dataDir = required("MSGCORE_DATA_DIR");

export const config = {
  isProduction,
  isTest,
  nodeEnv: optional("NODE_ENV", "development"),
  server: {
    host: required("MSGCORE_SERVER_HOST"),
    port: optionalInt("MSGCORE_SERVER_PORT", 5007),
  },
  db: {
    dataDir,
    dbPath: join(dataDir, "msgcore.db"),
  },
  logging: {
    level: optional("LOG_LEVEL", "info"),
    fileDir: process.env.MSGCORE_LOG_FILE_DIR,
  },
  internal: {
    secret: required("MSGCORE_INTERNAL_SECRET"),
  },
  auth: {
    jwtSecret: required("PERSONA_JWT_SECRET"),
  },
  cors: {
    origins: required("MSGCORE_CORS_ORIGINS")
      .split(",")
      .map((o) => o.trim()),
  },
};

export type Config = typeof config;

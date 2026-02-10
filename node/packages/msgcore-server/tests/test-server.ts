/**
 * MsgCore Test Server
 *
 * Starts a lightweight MsgCore server instance for integration testing.
 */

import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Server } from "http";
import type { TestDatabase } from "@agilehead/msgcore-test-utils";
import { createLogger } from "@agilehead/msgcore-logger";
import { createContext, type Context } from "../src/context/index.js";
import { resolvers } from "../src/resolvers/index.js";
import { createConversationRepository } from "../src/repositories/sqlite/conversation.js";
import { createMessageRepository } from "../src/repositories/sqlite/message.js";
import { createUserActivityRepository } from "../src/repositories/sqlite/user-activity.js";
import { createInternalRoutes } from "../src/routes/internal.js";

const logger = createLogger("msgcore-test-server");
const __dirname = dirname(fileURLToPath(import.meta.url));

export const TEST_INTERNAL_SECRET = "test-internal-secret";
export const TEST_JWT_SECRET = "test-jwt-secret";

export async function startTestServer(
  testDb: TestDatabase,
  port: number,
): Promise<{ stop(): Promise<void> }> {
  logger.info(`Starting test server on port ${String(port)}...`);

  // Create repositories with the test database
  const conversationRepo = createConversationRepository(testDb.db);
  const messageRepo = createMessageRepository(testDb.db);
  const userActivityRepo = createUserActivityRepository(testDb.db);

  const repos = {
    conversations: conversationRepo,
    messages: messageRepo,
    userActivity: userActivityRepo,
  };

  // Load GraphQL schema
  const schemaPath = join(__dirname, "../src/schema.graphql");
  const typeDefs = readFileSync(schemaPath, "utf-8");

  // Create Apollo Server
  const apolloServer = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    introspection: true,
  });

  await apolloServer.start();

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Internal routes
  app.use("/internal", createInternalRoutes(TEST_INTERNAL_SECRET, repos));

  // GraphQL endpoint
  app.use(
    "/graphql",
    expressMiddleware(apolloServer, {
      context: ({ req }) =>
        Promise.resolve(createContext(repos, TEST_JWT_SECRET, req)),
    }),
  );

  const server: Server = app.listen(port, () => {
    logger.info(
      `Test server ready at http://localhost:${String(port)}/graphql`,
    );
  });

  // Wait a moment for server to be fully ready
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    async stop(): Promise<void> {
      logger.info("Stopping test server...");
      await apolloServer.stop();
      await new Promise<void>((resolve, reject) => {
        server.close((err: Error | undefined) => {
          if (err !== undefined) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      logger.info("Test server stopped");
    },
  };
}

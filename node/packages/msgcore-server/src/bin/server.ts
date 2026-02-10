#!/usr/bin/env node
/**
 * MsgCore Server Entry Point
 *
 * Standalone conversation and messaging service
 */

import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "../config.js";
import { createLogger } from "@agilehead/msgcore-logger";
import { createContext, type Context } from "../context/index.js";
import { resolvers } from "../resolvers/index.js";
import { initSQLiteDatabase, closeSQLiteDatabase } from "@agilehead/msgcore-db";
import { createRepositories } from "../repositories/factory.js";
import { createInternalRoutes } from "../routes/internal.js";

const logger = createLogger("msgcore-server");
const __dirname = dirname(fileURLToPath(import.meta.url));

async function startServer(): Promise<void> {
  try {
    logger.info("Starting MsgCore server", {
      nodeEnv: config.nodeEnv,
      host: config.server.host,
      port: config.server.port,
    });

    logger.info("Initializing database", { dbPath: config.db.dbPath });
    const db = initSQLiteDatabase(config.db.dbPath);

    const repos = createRepositories(db);

    const schemaPath = join(__dirname, "../schema.graphql");
    const typeDefs = readFileSync(schemaPath, "utf-8");

    const server = new ApolloServer<Context>({
      typeDefs,
      resolvers,
      introspection: !config.isProduction,
      formatError: (formattedError, error) => {
        logger.error("GraphQL Error:", {
          message: formattedError.message,
          path: formattedError.path,
          extensions: formattedError.extensions,
          originalError: error,
        });
        return formattedError;
      },
    });

    await server.start();

    const app = express();
    if (config.isProduction) {
      app.set("trust proxy", 1);
    }
    app.use(cors({ origin: config.cors.origins, credentials: true }));
    app.use(express.json({ limit: "1mb" }));

    app.get("/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Internal service-to-service routes
    app.use("/internal", createInternalRoutes(config.internalSecret, repos));

    app.use(
      "/graphql",
      expressMiddleware(server, {
        context: ({ req }) =>
          Promise.resolve(createContext(repos, config.jwtSecret, req)),
      }),
    );

    const { host, port } = config.server;
    app.listen(port, host, () => {
      logger.info("MsgCore server started", {
        url: `http://${host}:${String(port)}`,
        graphql: `http://${host}:${String(port)}/graphql`,
      });
    });

    const shutdown = (): void => {
      logger.info("Shutting down gracefully...");
      closeSQLiteDatabase(db);
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start MsgCore server:", error);
    process.exit(1);
  }
}

void startServer().catch((error: unknown) => {
  logger.error("Unhandled error during startup:", error);
  process.exit(1);
});

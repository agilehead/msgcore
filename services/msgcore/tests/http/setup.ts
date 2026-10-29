import { after, before } from "node:test";
import { resolve, sep } from "node:path";
import {
  createTestDatabase,
  setupTestDatabase,
  teardownTestDatabase,
  truncateAllTables,
  type TestDatabase,
} from "@agilehead/msgcore-test-utils";

export let testDb: TestDatabase;
export let graphqlUrl: string;
export let serverBaseUrl: string;
export let internalSecret: string;
export let jwtSecret: string;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing test setting: ${name}`);
  return value;
}

export function setupGlobalHooks(): void {
  before(
    async function () {
      const path = resolve(required("TEST_DB_PATH"));
      if (!path.split(sep).includes(".tests"))
        throw new Error(
          "HTTP tests require a disposable database under .tests",
        );
      testDb = createTestDatabase(undefined, path);
      await setupTestDatabase(testDb);
      serverBaseUrl = required("TEST_URL").replace(/\/$/, "");
      graphqlUrl = `${serverBaseUrl}/graphql`;
      internalSecret = required("TEST_INTERNAL_SECRET");
      jwtSecret = required("TEST_JWT_SECRET");
    },
    { timeout: 60000 },
  );
  after(async () => teardownTestDatabase(testDb));
}

export function truncateTables(): void {
  truncateAllTables(testDb);
}

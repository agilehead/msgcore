/**
 * msgcore-test-utils - Test utilities for MsgCore service
 */

// Test database utilities
export {
  type TestDatabase,
  type TestDatabaseState,
  createTestDatabase,
  setupTestDatabase,
  truncateAllTables,
  teardownTestDatabase,
  getTestDatabaseInstance,
  getExternalTestDatabaseInstance,
  clearTestDatabaseInstance,
} from "./test-db.js";

// Test fixtures
export {
  generateId,
  createTestConversation,
  createTestMessage,
} from "./test-fixtures.js";

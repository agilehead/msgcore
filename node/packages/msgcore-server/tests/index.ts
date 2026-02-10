import { setupGlobalHooks } from "./setup.js";

// Setup global before/after hooks
setupGlobalHooks();

// Repository tests
import "./tests/repositories/conversation.test.js";
import "./tests/repositories/message.test.js";
import "./tests/repositories/user-activity.test.js";

// GraphQL resolver tests
import "./tests/resolvers/health.test.js";
import "./tests/resolvers/conversation.test.js";
import "./tests/resolvers/message.test.js";
import "./tests/resolvers/activity.test.js";

// Internal API tests
import "./tests/internal/routes.test.js";

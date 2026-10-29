import { setupGlobalHooks } from "./setup.js";
import "./tests/resolvers/health.test.js";
import "./tests/resolvers/conversation.test.js";
import "./tests/resolvers/message.test.js";
import "./tests/resolvers/activity.test.js";
import "./tests/internal/routes.test.js";

setupGlobalHooks();

import "dotenv/config";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get data directory from environment or use default
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const dataDir = resolve(workspace, process.env.MSGCORE_DATA_DIR || "./data");

export default {
  client: "better-sqlite3",
  connection: {
    filename: join(dataDir, "msgcore.db"),
  },
  useNullAsDefault: true,
  migrations: {
    directory: join(__dirname, "database/msgcore/sqlite/migrations"),
    extension: "js",
  },
  pool: {
    afterCreate: (conn, cb) => {
      conn.pragma("journal_mode = WAL");
      conn.pragma("foreign_keys = ON");
      cb();
    },
  },
};

/**
 * Initial schema for MsgCore conversation service
 *
 * Creates: conversation, conversation_participant, message, user_activity tables.
 */

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
  // Conversation threads
  await knex.schema.createTable("conversation", (table) => {
    table.string("id", 16).primary();
    table.string("context_type", 64);
    table.string("context_id", 64);
    table.string("title", 200);
    table.string("created_by", 32).notNullable();
    table.datetime("last_message_at").notNullable();
    table.datetime("created_at").notNullable();
  });

  await knex.schema.raw(
    "CREATE INDEX idx_conversation_context ON conversation(context_type, context_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX idx_conversation_created_by ON conversation(created_by)",
  );

  // Conversation participants
  await knex.schema.createTable("conversation_participant", (table) => {
    table.string("conversation_id", 16).notNullable();
    table.string("user_id", 32).notNullable();
    table.string("display_name", 100);
    table.datetime("last_seen_at");
    table.primary(["conversation_id", "user_id"]);
    table
      .foreign("conversation_id")
      .references("id")
      .inTable("conversation")
      .onDelete("CASCADE");
  });

  await knex.schema.raw(
    "CREATE INDEX idx_conversation_participant_user ON conversation_participant(user_id)",
  );

  // Messages within conversations
  await knex.schema.createTable("message", (table) => {
    table.string("id", 16).primary();
    table.string("conversation_id", 16).notNullable();
    table.string("sender_id", 32).notNullable();
    table.text("body").notNullable();
    table.text("metadata");
    table.string("reply_to", 16);
    table.integer("is_deleted").notNullable().defaultTo(0);
    table.text("deleted_reason");
    table.datetime("created_at").notNullable();
    table
      .foreign("conversation_id")
      .references("id")
      .inTable("conversation")
      .onDelete("CASCADE");
  });

  await knex.schema.raw(
    "CREATE INDEX idx_message_conversation ON message(conversation_id)",
  );
  await knex.schema.raw(
    "CREATE INDEX idx_message_sender ON message(sender_id)",
  );

  // Per-user activity tracking
  await knex.schema.createTable("user_activity", (table) => {
    table.string("user_id", 32).primary();
    table.datetime("last_seen_at");
    table.datetime("updated_at").notNullable();
  });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("message");
  await knex.schema.dropTableIfExists("conversation_participant");
  await knex.schema.dropTableIfExists("conversation");
  await knex.schema.dropTableIfExists("user_activity");
}

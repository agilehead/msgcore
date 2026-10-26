import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createMsgCoreClient } from "../../node/packages/msgcore-client/dist/index.js";

const fields = `id contextType contextId title createdBy lastMessageAt createdAt
  participants { userId displayName lastSeenAt }
  messages { id conversationId senderId body metadata replyTo isDeleted createdAt } hasUnread`;
const create = `mutation($input: CreateConversationInput!) { createConversation(input: $input) { ${fields} } }`;
const get = `query($id: String!) { conversation(id: $id) { ${fields} } }`;
const send = `mutation($id: String!, $body: String!, $metadata: String, $reply: String) {
  sendMessage(conversationId: $id, body: $body, metadata: $metadata, replyTo: $reply) {
    id conversationId senderId body metadata replyTo isDeleted createdAt
  }
}`;

export async function contracts({
  url,
  database,
  mode,
  secret,
  internalSecret,
}) {
  let passed = 0;
  async function check(name, run) {
    await run();
    passed++;
    console.info("HTTP contract PASS: " + name);
  }
  const token = (userId, extra = {}, algorithm = "HS256") =>
    jwt.sign({ sub: "identity", userId, ...extra }, secret, { algorithm });
  const alice = token("alice"),
    bob = token("bob"),
    outsider = token("outsider");
  async function graph(
    query,
    variables = {},
    authorization = alice,
    extraHeaders = {},
  ) {
    const response = await fetch(url + "/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization === null
          ? {}
          : { authorization: "Bearer " + authorization }),
        ...extraHeaders,
      },
      body: JSON.stringify({ query, variables }),
    });
    return { status: response.status, value: await response.json() };
  }
  async function data(
    query,
    variables = {},
    authorization = alice,
    extraHeaders = {},
  ) {
    const result = await graph(query, variables, authorization, extraHeaders);
    assert.equal(result.status, 200);
    assert.equal(result.value.errors, undefined);
    return result.value.data;
  }
  async function internal(
    path,
    method = "GET",
    body,
    authorization = internalSecret,
  ) {
    const response = await fetch(url + "/internal" + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(authorization === null
          ? {}
          : { authorization: "Bearer " + authorization }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, value: await response.json() };
  }
  let conversation, message;
  await check("health endpoints", async () => {
    const response = await fetch(url + "/health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal((await data("{ health }", {}, null)).health, "ok");
  });
  await check("required authentication and invalid JWT", async () => {
    for (const authorization of [
      null,
      "malformed",
      token("alice", { exp: 1 }),
      jwt.sign({ userId: "alice" }, "wrong"),
    ]) {
      const response = await graph(get, { id: "absent" }, authorization);
      assert.equal(response.value.errors[0].message, "Authentication required");
    }
  });
  await check(
    "HMAC algorithms and application identity preference",
    async () => {
      for (const algorithm of ["HS256", "HS384", "HS512"]) {
        const result = await data(
          create,
          { input: { participantIds: ["bob"] } },
          token("application-user", {}, algorithm),
        );
        assert.equal(result.createConversation.createdBy, "application-user");
      }
    },
  );
  await check("JWT sub fallback and temporal claims", async () => {
    const result = await data(
      create,
      { input: { participantIds: [] } },
      jwt.sign({ sub: "sub-user" }, secret),
    );
    assert.equal(result.createConversation.createdBy, "sub-user");
    for (const authorization of [
      jwt.sign({ email: "no-id" }, secret),
      token("alice", { nbf: 4102444800 }),
    ]) {
      assert.equal(
        (await graph(get, { id: "absent" }, authorization)).value.errors[0]
          .message,
        "Authentication required",
      );
    }
  });
  await check("cookie fallback including rejected bearer", async () => {
    const headers = { cookie: "access_token=" + alice };
    assert.equal(
      (await data(get, { id: "absent" }, null, headers)).conversation,
      null,
    );
    assert.equal(
      (await data(get, { id: "absent" }, "invalid", headers)).conversation,
      null,
    );
  });
  await check("conversation creation and display names", async () => {
    const result = await data(create, {
      input: {
        participantIds: ["bob", "bob", "alice"],
        title: "Native 雪 conversation",
        contextType: "item",
        contextId: "item-1",
        displayNames: [
          { userId: "alice", displayName: "Alice" },
          { userId: "bob", displayName: "Bób" },
        ],
      },
    });
    conversation = result.createConversation;
    assert.match(conversation.id, /^[0-9a-f]{16}$/);
    assert.equal(conversation.createdBy, "alice");
    assert.match(conversation.createdAt, /^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/);
    assert.equal(conversation.lastMessageAt, conversation.createdAt);
    assert.equal(conversation.participants.length, 2);
    assert.equal(
      conversation.participants.find((row) => row.userId === "bob").displayName,
      "Bób",
    );
    assert.equal(conversation.hasUnread, true);
  });
  await check("context idempotency and matching participants", async () => {
    const repeated = (
      await data(create, {
        input: {
          participantIds: ["bob"],
          contextType: "item",
          contextId: "item-1",
        },
      })
    ).createConversation;
    assert.equal(repeated.id, conversation.id);
    const found = await data(
      `query { conversationByContext(contextType:"item",contextId:"item-1",participantId:"alice") { id } }`,
      {},
      bob,
    );
    assert.equal(found.conversationByContext.id, conversation.id);
    const absent = await data(
      `query { conversationByContext(contextType:"item",contextId:"item-1",participantId:"outsider") { id } }`,
    );
    assert.equal(absent.conversationByContext, null);
  });
  await check("participant access isolation", async () => {
    assert.equal(
      (await data(get, { id: conversation.id }, outsider)).conversation,
      null,
    );
    assert.equal((await data(get, { id: "missing" })).conversation, null);
    assert.equal(
      (await data(get, { id: conversation.id }, bob)).conversation.id,
      conversation.id,
    );
  });
  await check(
    "paginated filtered search including participant names",
    async () => {
      const query = `query($search:String,$type:String,$limit:Int,$offset:Int) {
      myConversations(search:$search,contextType:$type,limit:$limit,offset:$offset) { nodes { id } totalCount pageInfo { hasNextPage hasPreviousPage } }
    }`;
      const first = (
        await data(query, {
          search: "NATIVE",
          type: "item",
          limit: 1,
          offset: 0,
        })
      ).myConversations;
      assert.equal(first.totalCount, 1);
      assert.equal(first.nodes[0].id, conversation.id);
      assert.deepEqual(first.pageInfo, {
        hasNextPage: false,
        hasPreviousPage: false,
      });
      assert.equal(
        (await data(query, { search: "Bób" })).myConversations.totalCount,
        1,
      );
      const next = (await data(query, { search: "Bób", offset: 1, limit: 1 }))
        .myConversations;
      assert.equal(next.nodes.length, 0);
      assert.equal(next.totalCount, 1);
      assert.equal(next.pageInfo.hasPreviousPage, true);
      assert.equal(
        (await data(query, { search: "missing-value" })).myConversations
          .totalCount,
        0,
      );
      assert.equal(
        (await data(query, { search: "%", type: "item" })).myConversations
          .totalCount,
        1,
      );
    },
  );
  await check("opaque metadata and message fields", async () => {
    const metadata = '{"amount":9007199254740993,"text":"☃"}';
    message = (
      await data(send, {
        id: conversation.id,
        body: "Hello\n☃",
        metadata,
        reply: "arbitrary-reply",
      })
    ).sendMessage;
    assert.match(message.id, /^[0-9a-f]{16}$/);
    assert.equal(message.conversationId, conversation.id);
    assert.equal(message.senderId, "alice");
    assert.equal(message.body, "Hello\n☃");
    assert.equal(message.metadata, metadata);
    assert.equal(message.replyTo, "arbitrary-reply");
    assert.equal(message.isDeleted, false);
    const stored = database.db
      .prepare(
        "SELECT metadata, is_deleted, created_at FROM message WHERE id = ?",
      )
      .get(message.id);
    assert.equal(stored.metadata, metadata);
    assert.equal(stored.is_deleted, 0);
    assert.equal(stored.created_at, message.createdAt);
  });
  await check("conversation field resolvers and unread marker", async () => {
    const value = (await data(get, { id: conversation.id }, bob)).conversation;
    assert.equal(value.messages[0].id, message.id);
    assert.equal(value.lastMessageAt, message.createdAt);
    assert.equal(value.hasUnread, true);
    assert.equal(
      (
        await data(
          `mutation($id:String!){ markConversationSeen(conversationId:$id) }`,
          { id: conversation.id },
          bob,
        )
      ).markConversationSeen,
      true,
    );
    assert.equal(
      (await data(get, { id: conversation.id }, bob)).conversation.hasUnread,
      false,
    );
  });
  await check("message and seen authorization errors", async () => {
    assert.equal(
      (await graph(send, { id: conversation.id, body: "forbidden" }, outsider))
        .value.errors[0].message,
      "Not a participant in this conversation",
    );
    assert.equal(
      (
        await graph(
          `mutation($id:String!){ deleteMessage(messageId:$id) }`,
          { id: message.id },
          bob,
        )
      ).value.errors[0].message,
      "Only the sender can delete their message",
    );
    assert.equal(
      (
        await graph(
          `mutation($id:String!){ markConversationSeen(conversationId:$id) }`,
          { id: conversation.id },
          outsider,
        )
      ).value.errors[0].message,
      "Not a participant in this conversation",
    );
  });
  await check(
    "soft deletion retains message and moderation carrier",
    async () => {
      assert.equal(
        (
          await data(`mutation($id:String!){ deleteMessage(messageId:$id) }`, {
            id: message.id,
          })
        ).deleteMessage,
        true,
      );
      const value = (await data(get, { id: conversation.id })).conversation
        .messages[0];
      assert.equal(value.body, "[deleted]");
      assert.equal(value.isDeleted, true);
      assert.equal(
        database.db
          .prepare("SELECT is_deleted FROM message WHERE id = ?")
          .get(message.id).is_deleted,
        1,
      );
      assert.equal(
        (await graph(`mutation{ deleteMessage(messageId:"absent") }`)).value
          .errors[0].message,
        "Message not found",
      );
    },
  );
  await check("activity marker and upsert", async () => {
    assert(
      (await data("{ activityCounts { newConversationCount } }", {}, bob))
        .activityCounts.newConversationCount > 0,
    );
    assert.equal(
      (await data("mutation { markAllSeen }", {}, bob)).markAllSeen,
      true,
    );
    assert.equal(
      (await data("{ activityCounts { newConversationCount } }", {}, bob))
        .activityCounts.newConversationCount,
      0,
    );
    assert.equal(
      (await data("mutation { markAllSeen }", {}, bob)).markAllSeen,
      true,
    );
  });
  await check("internal authentication", async () => {
    for (const authorization of [null, "wrong"])
      assert.equal(
        (await internal("/conversation", "POST", {}, authorization)).status,
        401,
      );
  });
  let internalConversation;
  await check("internal create snake_case contract", async () => {
    const response = await internal("/conversation", "POST", {
      participantIds: ["service-a", "service-b"],
      createdBy: "service-a",
      contextType: "ticket",
      contextId: "ticket-1",
      title: "Internal",
    });
    assert.equal(response.status, 201);
    internalConversation = response.value;
    assert.equal(internalConversation.created_by, "service-a");
    assert.equal(internalConversation.context_type, "ticket");
    assert.equal(internalConversation.createdBy, undefined);
  });
  await check(
    "internal idempotency returns existing row and status",
    async () => {
      const response = await internal("/conversation", "POST", {
        participantIds: ["service-b"],
        createdBy: "service-a",
        contextType: "ticket",
        contextId: "ticket-1",
      });
      assert.equal(response.status, 200);
      assert.equal(response.value.id, internalConversation.id);
      assert.equal(response.value.created_by, "service-a");
    },
  );
  await check("internal get camelCase contract", async () => {
    const response = await internal("/conversation/" + internalConversation.id);
    assert.equal(response.status, 200);
    assert.equal(response.value.createdBy, "service-a");
    assert.equal(response.value.participants.length, 2);
    assert.equal((await internal("/conversation/absent")).status, 404);
  });
  await check("internal validation and missing targets", async () => {
    for (const body of [{ participantIds: [] }, { participantIds: ["a"] }])
      assert.equal((await internal("/conversation", "POST", body)).status, 400);
    for (const body of [
      {},
      { conversationId: "a" },
      { conversationId: "a", senderId: "b" },
    ])
      assert.equal((await internal("/message", "POST", body)).status, 400);
    assert.equal(
      (
        await internal("/message", "POST", {
          conversationId: "absent",
          senderId: "a",
          body: "hello",
        })
      ).status,
      404,
    );
    assert.equal((await internal("/message/absent", "DELETE")).status, 404);
  });
  await check(
    "internal optional values never discard invalid metadata",
    async () => {
      const before = database.db
        .prepare("SELECT COUNT(*) AS count FROM message")
        .get().count;
      for (const field of ["metadata", "replyTo"]) {
        const response = await internal("/message", "POST", {
          conversationId: internalConversation.id,
          senderId: "system",
          body: "Invalid optional input",
          [field]: { unexpected: true },
        });
        assert.equal(response.status, 500);
        assert.equal(response.value.error, "Internal server error");
        assert.equal(
          database.db.prepare("SELECT COUNT(*) AS count FROM message").get()
            .count,
          before,
        );
      }
    },
  );
  await check("internal malformed JSON and array bodies rejected", async () => {
    for (const body of ["{", "[]", "null", "123"]) {
      const response = await fetch(url + "/internal/message", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + internalSecret,
        },
        body,
      });
      assert.equal(response.status, 400);
      await response.body?.cancel();
    }
  });
  let serviceMessage;
  await check("internal send allows service-owned sender", async () => {
    const response = await internal("/message", "POST", {
      conversationId: internalConversation.id,
      senderId: "system",
      body: "Service message",
      metadata: "opaque",
      replyTo: "reply",
    });
    assert.equal(response.status, 201);
    serviceMessage = response.value;
    assert.equal(serviceMessage.sender_id, "system");
    assert.equal(serviceMessage.conversation_id, internalConversation.id);
    assert.equal(serviceMessage.metadata, "opaque");
    assert.equal(serviceMessage.reply_to, "reply");
    assert.equal(serviceMessage.is_deleted, 0);
  });
  await check("internal moderation and anonymization", async () => {
    assert.deepEqual(
      (
        await internal("/message/" + serviceMessage.id, "DELETE", {
          reason: "moderation",
        })
      ).value,
      { success: true },
    );
    assert.equal(
      database.db
        .prepare("SELECT deleted_reason FROM message WHERE id = ?")
        .get(serviceMessage.id).deleted_reason,
      "moderation",
    );
    assert.deepEqual((await internal("/anonymize/system", "POST")).value, {
      success: true,
    });
    const stored = database.db
      .prepare(
        "SELECT sender_id, body, metadata, is_deleted FROM message WHERE id = ?",
      )
      .get(serviceMessage.id);
    assert.deepEqual(stored, {
      sender_id: "anonymous",
      body: "[anonymized]",
      metadata: null,
      is_deleted: 1,
    });
  });
  await check("existing SDK through real HTTP", async () => {
    const client = createMsgCoreClient({ endpoint: url, internalSecret });
    const response = await client.getConversationInternal(
      internalConversation.id,
    );
    assert.equal(response.success, true);
    assert.equal(response.data.id, internalConversation.id);
    assert.equal((await client.getConversationInternal("absent")).data, null);
    assert.equal(
      (await client.getConversation(conversation.id, alice)).data.id,
      conversation.id,
    );
    assert.equal((await client.getMyConversations({}, alice)).success, true);
    assert.equal((await client.getActivityCounts(alice)).success, true);
  });
  await check("GraphQL variable validation and syntax errors", async () => {
    for (const [query, variables, code] of [
      [get, {}, "BAD_USER_INPUT"],
      ["{", {}, "GRAPHQL_PARSE_FAILED"],
      ["{ unknownField }", {}, "GRAPHQL_VALIDATION_FAILED"],
    ]) {
      const response = await graph(query, variables);
      assert.equal(response.status, 400);
      assert.equal(response.value.errors[0].extensions.code, code);
    }
  });
  await check("GET queries and mutation rejection", async () => {
    const headers = { "apollo-require-preflight": "true" };
    const health = await fetch(
      url + "/graphql?query=" + encodeURIComponent("{health}"),
      { headers },
    );
    assert.equal(health.status, 200);
    const mutation = await fetch(
      url + "/graphql?query=" + encodeURIComponent("mutation{markAllSeen}"),
      { headers },
    );
    assert.equal(mutation.status, 405);
  });
  await check("production introspection setting", async () => {
    const response = await graph("{ __schema { queryType { name } } }");
    assert.equal(Boolean(response.value.errors?.length), mode === "production");
    if (mode !== "production")
      assert.equal(response.value.data.__schema.queryType.name, "Query");
  });
  await check("CORS origin and credentials", async () => {
    const response = await fetch(url + "/health", {
      headers: { origin: "http://localhost:3000" },
    });
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:3000",
    );
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true",
    );
  });
  await check("oversized JSON request rejected", async () => {
    const response = await fetch(url + "/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: "{health}",
        variables: { padding: "x".repeat(1024 * 1024) },
      }),
    });
    assert.equal(response.status, 413);
  });
  return passed;
}

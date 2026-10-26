using MsgCore.AdapterSqlite;
using MsgCore.AdapterAuth;
using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;
using MsgCore.Kernel;

var path = Path.GetFullPath(args.Single());
Storage.Initialize(path);
await using var db = Storage.Open(path);
var clock = new Clock(() => DateTimeOffset.Parse("2026-10-26T00:00:00.123Z", System.Globalization.CultureInfo.InvariantCulture));
var conversations = MsgCore.AdapterSqlite.Conversations.Conversations.Create(db, clock);
var messages = MsgCore.AdapterSqlite.Messages.Messages.Create(db, clock);
var activity = MsgCore.AdapterSqlite.Activity.Activities.Create(db, clock);
var unit = new UnitOfWork(db);
var ct = CancellationToken.None;
var count = 0;
void Check(bool value, string name)
{
    if (!value) throw new InvalidOperationException("Failed: " + name);
    count++;
}
T Value<T>(Result<T> result)
{
    Check(result.IsSuccess, "storage result");
    return result.Value;
}
var created = Value(await ConversationOperations.Create(conversations, unit, "alice", ["bob", "alice", "bob"],
    "item", "item-1", "Native search title", new Dictionary<string, string> { ["alice"] = "Alice", ["bob"] = "Bób" }, ct));
var conversation = created.Value;
Check(created.Created && conversation.Id.Length == 16 && conversation.Id.All(char.IsAsciiHexDigitLower), "canonical ID");
Check(conversation.CreatedAt == "2026-10-26T00:00:00.123Z", "existing ISO stored carrier");
Check(Value(await conversations.Participants(conversation.Id, ct)).Count == 2, "composite participants");
Check(Value(await conversations.Participant(conversation.Id, "bob", ct))?.DisplayName == "Bób", "Unicode display name");
Check(Value(await conversations.FindByContext("item", "item-1", ["bob", "alice"], ct))?.Id == conversation.Id, "captured array query");
Check(Value(await conversations.FindByContext("item", "item-1", [], ct))?.Id == conversation.Id, "empty captured array query");
Check(Value(await conversations.FindByContext("item", "item-1", ["missing"], ct)) is null, "unmatched captured array");
var existing = Value(await ConversationOperations.Create(conversations, unit, "alice", ["bob"], "item", "item-1", null,
    new Dictionary<string, string>(), ct));
Check(!existing.Created && existing.Value.Id == conversation.Id, "context idempotency");
Check(Value(await ConversationOperations.FindForParticipant(conversations, conversation.Id, "outsider", ct)) is null, "participant isolation");
Check(Value(await conversations.List("alice", "item", "SEARCH", 20, 0, ct)).TotalCount == 1, "database search and context filter");
Check(Value(await conversations.List("alice", null, "Bób", 20, 0, ct)).TotalCount == 1, "participant search");
Check(Value(await conversations.List("alice", null, null, 1, 1, ct)).Rows.Count == 0, "database pagination");
const string metadata = "{\"amount\":9007199254740993,\"text\":\"☃\"}";
var message = Value(await MessageOperations.SendByParticipant(conversations, messages, unit, conversation.Id,
    "alice", "Hello\n☃", metadata, "arbitrary-reply", ct));
Check(message.Body == "Hello\n☃" && message.Metadata == metadata && message.ReplyTo == "arbitrary-reply", "opaque message values");
Check(Value(await messages.List(conversation.Id, ct)).Count == 1, "message query");
Check(!(await MessageOperations.SendByParticipant(conversations, messages, unit, conversation.Id, "outsider", "no", null, null, ct)).IsSuccess,
    "send authorization");
Check(!(await MessageOperations.DeleteOwn(messages, message.Id, "bob", ct)).IsSuccess, "delete authorization");
Value(await messages.Delete(message.Id, "moderation", ct));
var deleted = Value(await messages.Find(message.Id, ct));
Check(deleted is { IsDeleted: true, Body: "[deleted]", DeletedReason: "moderation" }, "soft deletion storage");
Value(await ConversationOperations.MarkSeen(conversations, clock, conversation.Id, "bob", ct));
Check(Value(await conversations.Participant(conversation.Id, "bob", ct))?.LastSeenAt == clock.IsoNow(), "participant seen timestamp");
Check(Value(await activity.CountNew("bob", ct)) == 1, "activity independent of conversation seen");
Value(await unit.Run(token => activity.MarkAllSeen("bob", "2099-01-01T00:00:00.000Z", token), ct));
Check(Value(await activity.CountNew("bob", ct)) == 0, "activity marker");
Value(await unit.Run(token => activity.MarkAllSeen("bob", "2000-01-01T00:00:00.000Z", token), ct));
Check(Value(await activity.CountNew("bob", ct)) == 1, "activity upsert");
Value(await unit.Run(token => messages.Anonymize("alice", token), ct));
var anonymous = Value(await messages.Find(message.Id, ct));
Check(anonymous is { SenderId: "anonymous", Body: "[anonymized]", Metadata: null, IsDeleted: true }, "anonymization preserves deletion flag");
Check(Value(await conversations.Participant(conversation.Id, "alice", ct))?.DisplayName == "Anonymous", "participant anonymization");
var rollback = await unit.Run<Unit>(async token =>
{
    var insertion = await conversations.Create(new ConversationInput("rollback", null, null, null, "alice", []), token);
    return insertion.IsSuccess ? Result<Unit>.Failed("FIXTURE", "rollback") : Result<Unit>.Failed(insertion.Error!);
}, ct);
Check(!rollback.IsSuccess && Value(await conversations.Find("rollback", ct)) is null, "transaction rollback");
Check(!(await messages.Create(new MessageInput("invalid-fk", "absent", "alice", "body", null, null), ct)).IsSuccess, "foreign key enforcement");
using var canceled = new CancellationTokenSource();
canceled.Cancel();
var cancellationObserved = false;
try { await conversations.Find(conversation.Id, canceled.Token); }
catch (OperationCanceledException) { cancellationObserved = true; }
Check(cancellationObserved, "cancellation propagation");
Check(Tokens.Verify("malformed", "secret", clock.UtcNow()) is null, "malformed authentication");
Console.WriteLine($"MsgCore probe: {count} assertions passed");

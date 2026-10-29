using MsgCore.AdapterSqlite;
using MsgCore.AdapterAuth;
using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;
using MsgCore.Kernel;
using System.Security.Cryptography;
using System.Text;

var path = Path.GetFullPath(args.Single());
Storage.Initialize(path);
await using var db = Storage.Open(path);
var now = DateTimeOffset.Parse("2026-10-26T00:00:00.123Z", System.Globalization.CultureInfo.InvariantCulture);
var clock = new Clock(() => now);
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
Check(Value(await activity.CountNew("bob", ct)) == 1
    && Value(await activity.Find("bob", ct))?.LastSeenAt == "2000-01-01T00:00:00.000Z", "activity upsert");
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
Check(Value(await conversations.Find("missing", ct)) is null, "missing conversation");
Check(Value(await conversations.Participant(conversation.Id, "outsider", ct)) is null, "missing participant");
Check(Value(await activity.Find("no-activity", ct)) is null && Value(await activity.CountNew("no-activity", ct)) == 0,
    "missing activity and unread count");
for (var index = 0; index < 5; index++)
    Value(await conversations.Create(new ConversationInput($"page-{index}", index == 4 ? "order" : "item", $"page-context-{index}",
        index == 2 ? "About selling a bike" : $"Conversation {index}", "page-user", [new ParticipantInput("page-user", "Page User")]), ct));
var page = Value(await conversations.List("page-user", null, null, 3, 0, ct));
Check(page.TotalCount == 5 && page.Rows.Count == 3, "conversation total and page limit");
Check(Value(await conversations.List("page-user", "item", null, 20, 0, ct)).TotalCount == 4, "context type filter");
Check(Value(await conversations.List("page-user", null, "bike", 20, 0, ct)).Rows.Single().Id == "page-2", "title search filter");
Value(await conversations.Touch("page-0", "2026-11-01T00:00:00.000Z", ct));
Check(Value(await conversations.Find("page-0", ct))?.LastMessageAt == "2026-11-01T00:00:00.000Z", "last-message timestamp update");
Check(Value(await messages.Find("missing", ct)) is null, "missing message");
var firstOrdered = Value(await messages.Create(new MessageInput("ordered-first", "page-0", "page-user", "first", null, null), ct));
now = now.AddSeconds(1);
var secondOrdered = Value(await messages.Create(new MessageInput("ordered-second", "page-0", "page-user", "second", null, firstOrdered.Id), ct));
var ordered = Value(await messages.List("page-0", ct));
Check(ordered.Count == 2 && ordered[0].Id == firstOrdered.Id && ordered[1].Id == secondOrdered.Id
    && secondOrdered.ReplyTo == firstOrdered.Id, "message ordering and replies");
string Signed(string payload, string secret)
{
    static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    var prefix = Base64Url(Encoding.UTF8.GetBytes("{\"alg\":\"HS256\"}")) + "." + Base64Url(Encoding.UTF8.GetBytes(payload));
    return prefix + "." + Base64Url(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.ASCII.GetBytes(prefix)));
}
var signed = Signed("{\"sub\":\"identity\",\"userId\":\"application\",\"tenant\":\"tenant-a\"}", "secret");
Check(Tokens.Verify(signed, "secret", clock.UtcNow()) is { UserId: "application", Tenant: "tenant-a" }, "JWT application identity and tenant");
Check(Tokens.Verify(Signed("{\"sub\":\"fallback\"}", "secret"), "secret", clock.UtcNow()) is { UserId: "fallback", Tenant: null }, "JWT subject fallback");
Check(Tokens.Verify(Signed("{\"email\":\"no-identity\"}", "secret"), "secret", clock.UtcNow()) is null
    && Tokens.Verify(Signed("{\"userId\":\"alice\",\"exp\":1}", "secret"), "secret", clock.UtcNow()) is null
    && Tokens.Verify(signed, "wrong", clock.UtcNow()) is null, "JWT identity, expiry and signature rejection");
Console.WriteLine($"MsgCore probe: {count} assertions passed");

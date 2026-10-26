using MsgCore.Kernel;

namespace MsgCore.Domain.Messages;

public sealed record Message(string Id, string ConversationId, string SenderId, string Body, string? Metadata,
    string? ReplyTo, bool IsDeleted, string? DeletedReason, string CreatedAt);
public sealed record MessageInput(string Id, string ConversationId, string SenderId, string Body, string? Metadata, string? ReplyTo);
public sealed record MessageStore(
    Func<MessageInput, CancellationToken, Task<Result<Message>>> Create,
    Func<string, CancellationToken, Task<Result<Message?>>> Find,
    Func<string, CancellationToken, Task<Result<IReadOnlyList<Message>>>> List,
    Func<string, string?, CancellationToken, Task<Result<Unit>>> Delete,
    Func<string, CancellationToken, Task<Result<Unit>>> Anonymize);

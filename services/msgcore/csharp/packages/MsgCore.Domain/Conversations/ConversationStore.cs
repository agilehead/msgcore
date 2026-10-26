using MsgCore.Kernel;

namespace MsgCore.Domain.Conversations;

public sealed record Conversation(string Id, string? ContextType, string? ContextId, string? Title,
    string CreatedBy, string LastMessageAt, string CreatedAt);
public sealed record Participant(string ConversationId, string UserId, string? DisplayName, string? LastSeenAt);
public sealed record ParticipantInput(string UserId, string? DisplayName);
public sealed record ConversationInput(string Id, string? ContextType, string? ContextId, string? Title,
    string CreatedBy, IReadOnlyList<ParticipantInput> Participants);
public sealed record ConversationPage(IReadOnlyList<Conversation> Rows, int TotalCount);
public sealed record ConversationCreation(Conversation Value, bool Created);
public sealed record ConversationStore(
    Func<string, CancellationToken, Task<Result<Conversation?>>> Find,
    Func<string, string, string[], CancellationToken, Task<Result<Conversation?>>> FindByContext,
    Func<string, string?, string?, int, int, CancellationToken, Task<Result<ConversationPage>>> List,
    Func<string, CancellationToken, Task<Result<IReadOnlyList<Participant>>>> Participants,
    Func<string, string, CancellationToken, Task<Result<Participant?>>> Participant,
    Func<ConversationInput, CancellationToken, Task<Result<Conversation>>> Create,
    Func<string, string, CancellationToken, Task<Result<Unit>>> Touch,
    Func<string, string, string, CancellationToken, Task<Result<Unit>>> MarkSeen);

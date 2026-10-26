using MsgCore.Kernel;

namespace MsgCore.Domain.Conversations;

public static class ConversationOperations
{
    public static Task<Result<ConversationCreation>> Create(ConversationStore store, IUnitOfWork unit,
        string createdBy, IReadOnlyList<string> participantIds, string? contextType, string? contextId,
        string? title, IReadOnlyDictionary<string, string> displayNames, CancellationToken cancellation) =>
        unit.Run(async ct =>
        {
            var ids = participantIds.Append(createdBy).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
            if (contextType is not null && contextId is not null)
            {
                var existing = await store.FindByContext(contextType, contextId, ids, ct);
                if (!existing.IsSuccess) return Result<ConversationCreation>.Failed(existing.Error!);
                if (existing.Value is not null) return Result<ConversationCreation>.Success(new(existing.Value, false));
            }
            var participants = ids.Select(id => new ParticipantInput(id, displayNames.GetValueOrDefault(id))).ToArray();
            var created = await store.Create(new ConversationInput(Ids.New(), contextType, contextId, title, createdBy, participants), ct);
            return created.IsSuccess ? Result<ConversationCreation>.Success(new(created.Value, true))
                : Result<ConversationCreation>.Failed(created.Error!);
        }, cancellation);

    public static async Task<Result<Conversation?>> FindForParticipant(ConversationStore store, string id,
        string userId, CancellationToken cancellation)
    {
        var conversation = await store.Find(id, cancellation);
        if (!conversation.IsSuccess || conversation.Value is null) return conversation;
        var participant = await store.Participant(id, userId, cancellation);
        if (!participant.IsSuccess) return Result<Conversation?>.Failed(participant.Error!);
        return Result<Conversation?>.Success(participant.Value is null ? null : conversation.Value);
    }

    public static async Task<Result<Unit>> MarkSeen(ConversationStore store, Clock clock, string conversationId,
        string userId, CancellationToken cancellation)
    {
        var participant = await store.Participant(conversationId, userId, cancellation);
        if (!participant.IsSuccess) return Result<Unit>.Failed(participant.Error!);
        return participant.Value is null
            ? Result<Unit>.Failed("FORBIDDEN", "Not a participant in this conversation")
            : await store.MarkSeen(conversationId, userId, clock.IsoNow(), cancellation);
    }
}

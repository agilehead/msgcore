using Microsoft.EntityFrameworkCore;
using MsgCore.AdapterSqlite.Entities;
using MsgCore.Domain.Conversations;
using MsgCore.Kernel;

namespace MsgCore.AdapterSqlite.Conversations;

public static class Conversations
{
    public static ConversationStore Create(MsgCoreDbContext db, Clock clock) => new(
        (id, ct) => Storage.Guard(async () => Optional(await db.Conversation.AsNoTracking().FirstOrDefaultAsync(row => row.Id == id, ct))),
        (contextType, contextId, ids, ct) => Storage.Guard(async () =>
        {
            var requested = ids.Distinct(StringComparer.Ordinal).ToArray();
            var count = requested.Length;
            return Optional(await db.Conversation.AsNoTracking().Where(row => row.ContextType == contextType && row.ContextId == contextId
                && db.ConversationParticipant.Count(participant => participant.ConversationId == row.Id) == count
                && db.ConversationParticipant.Count(participant => participant.ConversationId == row.Id && requested.Contains(participant.UserId)) == count)
                .FirstOrDefaultAsync(ct));
        }),
        (userId, contextType, search, limit, offset, ct) => Storage.Guard(async () =>
        {
            var pattern = "%" + search + "%";
            var total = await db.Conversation.Where(row =>
                db.ConversationParticipant.Any(participant => participant.ConversationId == row.Id && participant.UserId == userId)
                && (contextType == null || row.ContextType == contextType)
                && (search == null || search == "" || EF.Functions.Like(row.Title!, pattern)
                    || db.ConversationParticipant.Any(participant => participant.ConversationId == row.Id && EF.Functions.Like(participant.DisplayName!, pattern))))
                .CountAsync(ct);
            var rows = await db.Conversation.AsNoTracking().Where(row =>
                db.ConversationParticipant.Any(participant => participant.ConversationId == row.Id && participant.UserId == userId)
                && (contextType == null || row.ContextType == contextType)
                && (search == null || search == "" || EF.Functions.Like(row.Title!, pattern)
                    || db.ConversationParticipant.Any(participant => participant.ConversationId == row.Id && EF.Functions.Like(participant.DisplayName!, pattern))))
                .OrderByDescending(row => row.LastMessageAt).Skip(offset).Take(limit).ToArrayAsync(ct);
            return new ConversationPage(rows.Select(Map).ToArray(), total);
        }),
        (id, ct) => Storage.Guard<IReadOnlyList<Participant>>(async () =>
            (await db.ConversationParticipant.AsNoTracking().Where(row => row.ConversationId == id).ToArrayAsync(ct)).Select(Map).ToArray()),
        (id, userId, ct) => Storage.Guard(async () =>
        {
            var row = await db.ConversationParticipant.AsNoTracking().FirstOrDefaultAsync(row => row.ConversationId == id && row.UserId == userId, ct);
            return row is null ? null : Map(row);
        }),
        (input, ct) => Storage.Guard(async () =>
        {
            var now = clock.IsoNow();
            var row = new ConversationRow { Id = input.Id, ContextType = input.ContextType, ContextId = input.ContextId,
                Title = input.Title, CreatedBy = input.CreatedBy, LastMessageAt = now, CreatedAt = now };
            db.Conversation.Add(row);
            foreach (var participant in input.Participants)
                db.ConversationParticipant.Add(new ConversationParticipantRow { ConversationId = row.Id, UserId = participant.UserId,
                    DisplayName = participant.DisplayName, LastSeenAt = null });
            await Storage.Save(db, ct);
            return Map(row);
        }),
        (id, timestamp, ct) => Storage.Guard(async () =>
        {
            await db.Conversation.Where(row => row.Id == id).ExecuteUpdateAsync(setters => setters.SetProperty(row => row.LastMessageAt, timestamp), ct);
            return new Unit();
        }),
        (id, userId, timestamp, ct) => Storage.Guard(async () =>
        {
            await db.ConversationParticipant.Where(row => row.ConversationId == id && row.UserId == userId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.LastSeenAt, timestamp), ct);
            return new Unit();
        }));

    public static Conversation Map(ConversationRow row) => new(row.Id, row.ContextType, row.ContextId, row.Title,
        row.CreatedBy, row.LastMessageAt, row.CreatedAt);
    public static Participant Map(ConversationParticipantRow row) => new(row.ConversationId, row.UserId, row.DisplayName, row.LastSeenAt);
    private static Conversation? Optional(ConversationRow? row) => row is null ? null : Map(row);
}

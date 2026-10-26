using Microsoft.EntityFrameworkCore;
using MsgCore.AdapterSqlite.Entities;
using MsgCore.Domain.Messages;
using MsgCore.Kernel;

namespace MsgCore.AdapterSqlite.Messages;

public static class Messages
{
    public static MessageStore Create(MsgCoreDbContext db, Clock clock) => new(
        (input, ct) => Storage.Guard(async () =>
        {
            var row = new MessageRow { Id = input.Id, ConversationId = input.ConversationId, SenderId = input.SenderId,
                Body = input.Body, Metadata = input.Metadata, ReplyTo = input.ReplyTo, IsDeleted = 0, DeletedReason = null, CreatedAt = clock.IsoNow() };
            db.Message.Add(row);
            await Storage.Save(db, ct);
            return Map(row);
        }),
        (id, ct) => Storage.Guard(async () =>
        {
            var row = await db.Message.AsNoTracking().FirstOrDefaultAsync(row => row.Id == id, ct);
            return row is null ? null : Map(row);
        }),
        (id, ct) => Storage.Guard<IReadOnlyList<Message>>(async () =>
            (await db.Message.AsNoTracking().Where(row => row.ConversationId == id).OrderBy(row => row.CreatedAt).ToArrayAsync(ct)).Select(Map).ToArray()),
        (id, reason, ct) => Storage.Guard(async () =>
        {
            await db.Message.Where(row => row.Id == id).ExecuteUpdateAsync(setters => setters
                .SetProperty(row => row.IsDeleted, 1L).SetProperty(row => row.DeletedReason, reason).SetProperty(row => row.Body, "[deleted]"), ct);
            return new Unit();
        }),
        (userId, ct) => Storage.Guard(async () =>
        {
            await db.Message.Where(row => row.SenderId == userId).ExecuteUpdateAsync(setters => setters
                .SetProperty(row => row.Body, "[anonymized]").SetProperty(row => row.Metadata, (string?)null).SetProperty(row => row.SenderId, "anonymous"), ct);
            await db.ConversationParticipant.Where(row => row.UserId == userId).ExecuteUpdateAsync(setters => setters.SetProperty(row => row.DisplayName, "Anonymous"), ct);
            return new Unit();
        }));

    public static Message Map(MessageRow row) => new(row.Id, row.ConversationId, row.SenderId, row.Body,
        row.Metadata, row.ReplyTo, row.IsDeleted == 1, row.DeletedReason, row.CreatedAt);
}

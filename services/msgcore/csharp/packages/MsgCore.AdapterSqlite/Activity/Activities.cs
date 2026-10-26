using Microsoft.EntityFrameworkCore;
using MsgCore.AdapterSqlite.Entities;
using MsgCore.Domain.Activity;
using MsgCore.Kernel;

namespace MsgCore.AdapterSqlite.Activity;

public static class Activities
{
    public static ActivityStore Create(MsgCoreDbContext db, Clock clock) => new(
        (userId, ct) => Storage.Guard(async () =>
        {
            var row = await db.UserActivity.AsNoTracking().FirstOrDefaultAsync(row => row.UserId == userId, ct);
            return row is null ? null : new Domain.Activity.Activity(row.UserId, row.LastSeenAt, row.UpdatedAt);
        }),
        (userId, timestamp, ct) => Storage.Guard(async () =>
        {
            var row = await db.UserActivity.FirstOrDefaultAsync(row => row.UserId == userId, ct);
            if (row is null) db.UserActivity.Add(new UserActivityRow { UserId = userId, LastSeenAt = timestamp, UpdatedAt = clock.IsoNow() });
            else { row.LastSeenAt = timestamp; row.UpdatedAt = clock.IsoNow(); }
            await Storage.Save(db, ct);
            return new Unit();
        }),
        (userId, ct) => Storage.Guard(async () =>
        {
            var activity = await db.UserActivity.AsNoTracking().FirstOrDefaultAsync(row => row.UserId == userId, ct);
            var seen = activity?.LastSeenAt;
            return await db.Conversation.Where(row => db.ConversationParticipant.Any(participant => participant.ConversationId == row.Id && participant.UserId == userId)
                && (seen == null || row.LastMessageAt.CompareTo(seen) > 0)).CountAsync(ct);
        }));
}

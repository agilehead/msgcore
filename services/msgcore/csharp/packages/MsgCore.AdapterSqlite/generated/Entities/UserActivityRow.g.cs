#nullable enable

namespace MsgCore.AdapterSqlite.Entities;

public sealed class UserActivityRow
{
    public required string UserId { get; set; }
    public string? LastSeenAt { get; set; }
    public required string UpdatedAt { get; set; }
}

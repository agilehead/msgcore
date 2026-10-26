#nullable enable

namespace MsgCore.AdapterSqlite.Entities;

public sealed class ConversationParticipantRow
{
    public required string ConversationId { get; set; }
    public required string UserId { get; set; }
    public string? DisplayName { get; set; }
    public string? LastSeenAt { get; set; }
}

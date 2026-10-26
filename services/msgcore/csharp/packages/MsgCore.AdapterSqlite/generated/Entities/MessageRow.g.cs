#nullable enable

namespace MsgCore.AdapterSqlite.Entities;

public sealed class MessageRow
{
    public required string Id { get; set; }
    public required string ConversationId { get; set; }
    public required string SenderId { get; set; }
    public required string Body { get; set; }
    public string? Metadata { get; set; }
    public string? ReplyTo { get; set; }
    public long IsDeleted { get; set; }
    public string? DeletedReason { get; set; }
    public required string CreatedAt { get; set; }
}

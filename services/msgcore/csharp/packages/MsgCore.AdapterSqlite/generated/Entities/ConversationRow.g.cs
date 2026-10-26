#nullable enable

namespace MsgCore.AdapterSqlite.Entities;

public sealed class ConversationRow
{
    public required string Id { get; set; }
    public string? ContextType { get; set; }
    public string? ContextId { get; set; }
    public string? Title { get; set; }
    public required string CreatedBy { get; set; }
    public required string LastMessageAt { get; set; }
    public required string CreatedAt { get; set; }
}

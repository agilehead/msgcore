using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;

namespace MsgCore.AdapterGraphql;

public static class Values
{
    public static Dictionary<string, object?>? Conversation(Conversation? row) => row is null ? null : new()
    {
        ["id"] = row.Id, ["contextType"] = row.ContextType, ["contextId"] = row.ContextId, ["title"] = row.Title,
        ["createdBy"] = row.CreatedBy, ["lastMessageAt"] = row.LastMessageAt, ["createdAt"] = row.CreatedAt
    };
    public static Dictionary<string, object?> Participant(Participant row) => new()
    { ["userId"] = row.UserId, ["displayName"] = row.DisplayName, ["lastSeenAt"] = row.LastSeenAt };
    public static Dictionary<string, object?> Message(Message row) => new()
    {
        ["id"] = row.Id, ["conversationId"] = row.ConversationId, ["senderId"] = row.SenderId, ["body"] = row.Body,
        ["metadata"] = row.Metadata, ["replyTo"] = row.ReplyTo, ["isDeleted"] = row.IsDeleted, ["createdAt"] = row.CreatedAt
    };
}

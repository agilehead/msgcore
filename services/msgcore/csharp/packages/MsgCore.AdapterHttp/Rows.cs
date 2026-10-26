using System.Text.Json.Nodes;
using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;

namespace MsgCore.AdapterHttp;

public static class Rows
{
    public static JsonObject Conversation(Conversation row) => new()
    {
        ["id"] = row.Id, ["context_type"] = row.ContextType, ["context_id"] = row.ContextId, ["title"] = row.Title,
        ["created_by"] = row.CreatedBy, ["last_message_at"] = row.LastMessageAt, ["created_at"] = row.CreatedAt
    };
    public static JsonObject Message(Message row) => new()
    {
        ["id"] = row.Id, ["conversation_id"] = row.ConversationId, ["sender_id"] = row.SenderId, ["body"] = row.Body,
        ["metadata"] = row.Metadata, ["reply_to"] = row.ReplyTo, ["is_deleted"] = row.IsDeleted ? 1 : 0,
        ["deleted_reason"] = row.DeletedReason, ["created_at"] = row.CreatedAt
    };
}

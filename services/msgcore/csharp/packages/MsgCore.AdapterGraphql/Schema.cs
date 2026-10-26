using GraphQL;
using GraphQL.Types;
using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;
using MsgCore.Kernel;

namespace MsgCore.AdapterGraphql;

public static class Schema
{
    public static ISchema Create() => SchemaDefinitions.Build("Public", Resolve);

    private static async ValueTask<object?> Resolve(IResolveFieldContext context)
    {
        var session = (RequestSession)context.UserContext["session"]!;
        var ct = context.CancellationToken;
        var field = context.FieldDefinition.Name;
        if (context.Source is IDictionary<string, object?> source)
        {
            if (context.ParentType.Name == "Conversation")
            {
                var id = (string)source["id"]!;
                if (field == "participants") return Wire.Unwrap(await session.Conversations.Participants(id, ct)).Select(Values.Participant).ToArray();
                if (field == "messages") return Wire.Unwrap(await session.Messages.List(id, ct)).Select(Values.Message).ToArray();
                if (field == "hasUnread")
                {
                    if (session.UserId is null) return false;
                    var participant = Wire.Unwrap(await session.Conversations.Participant(id, session.UserId, ct));
                    return participant is not null && (participant.LastSeenAt is null
                        || string.CompareOrdinal((string)source["lastMessageAt"]!, participant.LastSeenAt) > 0);
                }
            }
            return source.TryGetValue(field, out var value) ? value : null;
        }
        if (field == "health") return "ok";
        var userId = session.UserId ?? throw Wire.Error("Authentication required", "INTERNAL_SERVER_ERROR");
        switch (field)
        {
            case "conversation": return Values.Conversation(Wire.Unwrap(await ConversationOperations.FindForParticipant(
                session.Conversations, context.GetArgument<string>("id"), userId, ct)));
            case "conversationByContext":
            {
                var ids = new[] { userId, context.GetArgument<string>("participantId") }.Order(StringComparer.Ordinal).ToArray();
                var conversation = Wire.Unwrap(await session.Conversations.FindByContext(context.GetArgument<string>("contextType"),
                    context.GetArgument<string>("contextId"), ids, ct));
                return conversation is null ? null : Values.Conversation(Wire.Unwrap(await ConversationOperations.FindForParticipant(
                    session.Conversations, conversation.Id, userId, ct)));
            }
            case "myConversations":
            {
                var limit = context.GetArgument<int?>("limit") ?? 20;
                var offset = context.GetArgument<int?>("offset") ?? 0;
                var page = Wire.Unwrap(await session.Conversations.List(userId, context.GetArgument<string?>("contextType"),
                    context.GetArgument<string?>("search"), limit, offset, ct));
                return new Dictionary<string, object?> { ["nodes"] = page.Rows.Select(Values.Conversation).ToArray(),
                    ["totalCount"] = page.TotalCount, ["pageInfo"] = new Dictionary<string, object?>
                    { ["hasNextPage"] = (long)offset + limit < page.TotalCount, ["hasPreviousPage"] = offset > 0 } };
            }
            case "activityCounts": return new Dictionary<string, object?> { ["newConversationCount"] = Wire.Unwrap(await session.Activity.CountNew(userId, ct)) };
            case "createConversation":
            {
                var input = context.GetArgument<Dictionary<string, object?>>("input");
                var ids = ((IEnumerable<object?>)input["participantIds"]!).Select(value => (string)value!).ToArray();
                var names = new Dictionary<string, string>(StringComparer.Ordinal);
                if (input.TryGetValue("displayNames", out var displayNames) && displayNames is IEnumerable<object?> values)
                    foreach (var value in values)
                    {
                        var name = (IDictionary<string, object?>)value!;
                        names[(string)name["userId"]!] = (string)name["displayName"]!;
                    }
                var created = Wire.Unwrap(await ConversationOperations.Create(session.Conversations, session.UnitOfWork, userId,
                    ids, Text(input, "contextType"), Text(input, "contextId"), Text(input, "title"), names, ct));
                return Values.Conversation(created.Value);
            }
            case "sendMessage": return Values.Message(Wire.Unwrap(await MessageOperations.SendByParticipant(session.Conversations,
                session.Messages, session.UnitOfWork, context.GetArgument<string>("conversationId"), userId, context.GetArgument<string>("body"),
                context.GetArgument<string?>("metadata"), context.GetArgument<string?>("replyTo"), ct)));
            case "deleteMessage":
                Wire.Unwrap(await MessageOperations.DeleteOwn(session.Messages, context.GetArgument<string>("messageId"), userId, ct)); return true;
            case "markConversationSeen":
                Wire.Unwrap(await ConversationOperations.MarkSeen(session.Conversations, session.Clock, context.GetArgument<string>("conversationId"), userId, ct)); return true;
            case "markAllSeen":
                Wire.Unwrap(await session.UnitOfWork.Run(token => session.Activity.MarkAllSeen(userId, session.Clock.IsoNow(), token), ct)); return true;
            default: throw new InvalidOperationException("Unknown MsgCore field: " + field);
        }
    }

    private static string? Text(IDictionary<string, object?> input, string name) => input.TryGetValue(name, out var value) ? value as string : null;
}

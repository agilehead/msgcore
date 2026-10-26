using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using MsgCore.AdapterGraphql;
using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;
using MsgCore.Kernel;

namespace MsgCore.AdapterHttp;

public static class InternalRoutes
{
    public static async Task Handle(HttpContext context, RequestSession session)
    {
        var path = context.Request.Path.Value?.TrimEnd('/') ?? "";
        var ct = context.RequestAborted;
        if (HttpMethods.IsGet(context.Request.Method) && path.StartsWith("/internal/conversation/", StringComparison.Ordinal))
        {
            var id = path["/internal/conversation/".Length..];
            var found = await session.Conversations.Find(id, ct);
            if (!await Success(context, found)) return;
            if (found.Value is null) { await Error(context, 404, "Conversation not found"); return; }
            var participants = await session.Conversations.Participants(id, ct);
            if (!await Success(context, participants)) return;
            var row = found.Value;
            await GraphqlEndpoint.Json(context, new JsonObject
            {
                ["id"] = row.Id, ["contextType"] = row.ContextType, ["contextId"] = row.ContextId, ["title"] = row.Title,
                ["createdBy"] = row.CreatedBy, ["lastMessageAt"] = row.LastMessageAt, ["createdAt"] = row.CreatedAt,
                ["participants"] = new JsonArray(participants.Value.Select(participant => (JsonNode?)new JsonObject
                { ["userId"] = participant.UserId, ["displayName"] = participant.DisplayName, ["lastSeenAt"] = participant.LastSeenAt }).ToArray())
            });
            return;
        }
        var parsedBody = context.Request.ContentLength == 0 || context.Request.ContentLength is null && !context.Request.Headers.ContainsKey("Transfer-Encoding")
            ? new JsonObject() : await JsonNode.ParseAsync(context.Request.Body, cancellationToken: ct);
        if (parsedBody is not JsonObject body)
        { await Error(context, 400, "Invalid request body"); return; }
        if (HttpMethods.IsPost(context.Request.Method) && path == "/internal/conversation")
        {
            if (body["participantIds"] is not JsonArray { Count: > 0 } ids)
            { await Error(context, 400, "participantIds is required"); return; }
            var creator = Text(body, "createdBy");
            if (string.IsNullOrEmpty(creator)) { await Error(context, 400, "createdBy is required"); return; }
            var names = new Dictionary<string, string>(StringComparer.Ordinal);
            if (body["displayNames"] is JsonArray displayNames)
                foreach (var name in displayNames) names[Text(name!.AsObject(), "userId")!] = OptionalText(name.AsObject(), "displayName")!;
            var result = await ConversationOperations.Create(session.Conversations, session.UnitOfWork, creator,
                ids.Select(id => id!.GetValue<string>()).ToArray(), OptionalText(body, "contextType"), OptionalText(body, "contextId"), OptionalText(body, "title"), names, ct);
            if (!await Success(context, result)) return;
            context.Response.StatusCode = result.Value.Created ? 201 : 200;
            await GraphqlEndpoint.Json(context, Rows.Conversation(result.Value.Value));
            return;
        }
        if (HttpMethods.IsPost(context.Request.Method) && path == "/internal/message")
        {
            foreach (var field in new[] { "conversationId", "senderId", "body" })
                if (body[field] is not JsonValue value || !value.TryGetValue<string>(out var text) || text.Length == 0)
                { await Error(context, 400, field + " is required"); return; }
            var result = await MessageOperations.Send(session.Conversations, session.Messages, session.UnitOfWork,
                Text(body, "conversationId")!, Text(body, "senderId")!, Text(body, "body")!, OptionalText(body, "metadata"), OptionalText(body, "replyTo"), ct);
            if (!await Success(context, result)) return;
            context.Response.StatusCode = 201;
            await GraphqlEndpoint.Json(context, Rows.Message(result.Value));
            return;
        }
        if (HttpMethods.IsDelete(context.Request.Method) && path.StartsWith("/internal/message/", StringComparison.Ordinal))
        {
            var id = path["/internal/message/".Length..];
            var found = await session.Messages.Find(id, ct);
            if (!await Success(context, found)) return;
            if (found.Value is null) { await Error(context, 404, "Message not found"); return; }
            if (!await Success(context, await session.Messages.Delete(id, Text(body, "reason"), ct))) return;
            await GraphqlEndpoint.Json(context, new JsonObject { ["success"] = true });
            return;
        }
        if (HttpMethods.IsPost(context.Request.Method) && path.StartsWith("/internal/anonymize/", StringComparison.Ordinal))
        {
            var id = path["/internal/anonymize/".Length..];
            if (!await Success(context, await session.UnitOfWork.Run(token => session.Messages.Anonymize(id, token), ct))) return;
            await GraphqlEndpoint.Json(context, new JsonObject { ["success"] = true });
            return;
        }
        context.Response.StatusCode = 404;
    }

    private static string? Text(JsonObject input, string name) => input[name] is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;

    private static string? OptionalText(JsonObject input, string name) => input[name] is null ? null
        : input[name] is JsonValue value && value.TryGetValue<string>(out var text) ? text
        : throw new InvalidOperationException("Invalid string value for " + name);

    private static async Task<bool> Success<T>(HttpContext context, Result<T> result)
    {
        if (result.IsSuccess) return true;
        if (result.Error!.Code == "NOT_FOUND") await Error(context, 404, result.Error.Message);
        else
        {
            context.Response.StatusCode = 500;
            await GraphqlEndpoint.Json(context, new JsonObject { ["error"] = "Internal server error", ["message"] = result.Error.Message });
        }
        return false;
    }

    private static Task Error(HttpContext context, int status, string message)
    {
        context.Response.StatusCode = status;
        return GraphqlEndpoint.Json(context, new JsonObject { ["error"] = message });
    }
}

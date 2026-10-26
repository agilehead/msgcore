using System.Text.Json;
using System.Text.Json.Nodes;
using System.Net.Http.Headers;
using GraphQL;
using GraphQL.Types;
using GraphQL.Validation;
using GraphQL.Validation.Rules.Custom;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using MsgCore.AdapterGraphql;
using MsgCore.Contracts;

namespace MsgCore.AdapterHttp;

public static class GraphqlEndpoint
{
    public static async Task<GraphqlRequest?> Read(HttpContext context)
    {
        if (HttpMethods.IsGet(context.Request.Method))
        {
            if (!NonSimpleContentType(context.Request.ContentType)
                && string.IsNullOrEmpty(context.Request.Headers["apollo-require-preflight"].FirstOrDefault())
                && string.IsNullOrEmpty(context.Request.Headers["x-apollo-operation-name"].FirstOrDefault()))
            {
                await Error(context, 400, "This operation has been blocked as a potential Cross-Site Request Forgery (CSRF).", "BAD_REQUEST");
                return null;
            }
            var parameters = context.Request.Query;
            var query = parameters["query"].ToString();
            var variableText = parameters["variables"].ToString();
            try
            {
                return new GraphqlRequest(query, parameters["operationName"].FirstOrDefault(),
                    variableText.Length == 0 ? null : JsonNode.Parse(variableText)?.AsObject());
            }
            catch (Exception exception) when (exception is JsonException or InvalidOperationException)
            {
                await Error(context, 400, "Variables are invalid JSON.", "BAD_REQUEST");
                return null;
            }
        }
        if (!HttpMethods.IsPost(context.Request.Method))
        {
            context.Response.Headers.Allow = "GET, POST";
            await Error(context, 405, "GraphQL only supports GET and POST requests.", "BAD_REQUEST");
            return null;
        }
        if (!MediaTypeHeaderValue.TryParse(context.Request.ContentType, out var contentType)
            || !string.Equals(contentType.MediaType, "application/json", StringComparison.OrdinalIgnoreCase))
        {
            await Error(context, 400, "POST body must be JSON.", "BAD_REQUEST");
            return null;
        }
        try
        {
            var body = await JsonNode.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted);
            if (body is not JsonObject map || map["query"] is not JsonValue value || !value.TryGetValue<string>(out var query))
            {
                await Error(context, 400, "GraphQL operations must contain a non-empty query.", "BAD_REQUEST");
                return null;
            }
            return new GraphqlRequest(query, map["operationName"]?.GetValue<string>(), map["variables"]?.AsObject());
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException)
        {
            await Error(context, 400, "POST body is invalid JSON.", "BAD_REQUEST");
            return null;
        }
    }

    public static async Task Execute(HttpContext context, ISchema schema, GraphqlRequest request,
        object session, int maxDepth, bool development)
    {
        var rules = DocumentValidator.CoreRules.Append(new QueryDepth(maxDepth));
        if (!development) rules = rules.Append(NoIntrospectionValidationRule.Instance);
        if (HttpMethods.IsGet(context.Request.Method)) rules = rules.Append(new ReadOnlyOperation(request.OperationName));
        var result = await new RepositoryExecuter().ExecuteAsync(options =>
        {
            options.Schema = schema;
            options.Query = request.Query;
            options.OperationName = request.OperationName;
            options.Variables = request.Variables is { } variables ? Wire.Inputs(variables) : null;
            options.UserContext = new Dictionary<string, object?> { ["session"] = session };
            options.CancellationToken = context.RequestAborted;
            options.ValidationRules = rules;
        });
        context.Response.StatusCode = result.Errors?.Any(error => error.Code == "METHOD_NOT_ALLOWED") == true ? 405
            : result.Executed ? 200 : 400;
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.Body.WriteAsync(GraphqlResults.Serialize(result), context.RequestAborted);
    }

    public static void Limit(HttpContext context, long bytes)
    {
        if (context.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } feature)
            feature.MaxRequestBodySize = bytes;
    }

    public static async Task Error(HttpContext context, int status, string message, string code)
    {
        context.Response.StatusCode = status;
        await Json(context, new JsonObject { ["errors"] = new JsonArray(new JsonObject
        {
            ["message"] = message, ["extensions"] = new JsonObject { ["code"] = code }
        }) });
    }

    public static async Task Json(HttpContext context, JsonObject value)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        await context.Response.WriteAsync(value.ToJsonString(), context.RequestAborted);
    }

    private static bool NonSimpleContentType(string? value) => MediaTypeHeaderValue.TryParse(value, out var parsed)
        && parsed.MediaType is { } mediaType && mediaType.Contains('/', StringComparison.Ordinal)
        && !mediaType.Equals("text/plain", StringComparison.OrdinalIgnoreCase)
        && !mediaType.Equals("application/x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase)
        && !mediaType.Equals("multipart/form-data", StringComparison.OrdinalIgnoreCase);
}

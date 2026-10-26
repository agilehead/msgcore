using System.Text.Json.Nodes;

namespace MsgCore.Contracts;

public sealed record GraphqlRequest(string Query, string? OperationName, JsonObject? Variables);

using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using GraphQL;
using MsgCore.Contracts;
using MsgCore.Kernel;

namespace MsgCore.AdapterGraphql;

public static class Wire
{
    public static Inputs Inputs(JsonObject variables) => new(variables.ToDictionary(
        variable => variable.Key, variable => InputValue(variable.Value), StringComparer.Ordinal));

    private static object? InputValue(JsonNode? value) => value switch
    {
        JsonObject map => map.ToDictionary(property => property.Key,
            property => InputValue(property.Value), StringComparer.Ordinal),
        JsonArray array => array.Select(InputValue).ToArray(),
        _ => Scalar(value)
    };

    public static JsonNode? Node<T>(T value, JsonTypeInfo<T> type) =>
        JsonSerializer.SerializeToNode(value, type);

    public static T Unwrap<T>(Result<T> result)
    {
        if (result.IsSuccess) return result.Value;
        if (result.Error!.Code == "INFRASTRUCTURE")
            throw new ExecutionError("Something went wrong on our side. Please try again.", result.Error.Cause)
            {
                Code = "INTERNAL_SERVER_ERROR"
            };
        throw Error(result.Error!.Message, "INTERNAL_SERVER_ERROR");
    }

    public static ExecutionError Error(string message, string code) => new(message) { Code = code };

    public static object? Scalar(JsonNode? value) => value switch
    {
        null => null,
        JsonArray array => array.Select(Scalar).ToArray(),
        JsonObject => value,
        JsonValue scalar when scalar.TryGetValue<string>(out var text) => text,
        JsonValue scalar when scalar.TryGetValue<bool>(out var boolean) => boolean,
        JsonValue scalar when scalar.TryGetValue<int>(out var integer) => integer,
        JsonValue scalar when scalar.TryGetValue<long>(out var integer) => integer,
        JsonValue scalar when scalar.TryGetValue<double>(out var number) => number,
        JsonValue scalar when scalar.TryGetValue<JsonElement>(out var element) => element.ValueKind switch
        {
            JsonValueKind.Null => null,
            JsonValueKind.String => element.GetString(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number when element.TryGetInt64(out var integer) => integer,
            JsonValueKind.Number => element.GetDouble(),
            _ => throw new InvalidOperationException("Expected a JSON scalar.")
        },
        _ => throw new InvalidOperationException("Expected a JSON scalar.")
    };
}

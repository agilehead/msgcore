using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using GraphQL;
using GraphQL.Execution;
using GraphQL.SystemTextJson;
using GraphQL.Validation;

namespace MsgCore.AdapterGraphql;

public static class GraphqlResults
{
    private static readonly JsonSerializerOptions Options = new()
    {
        TypeInfoResolver = new ResultTypes()
    };

    public static byte[] Serialize(ExecutionResult result) => JsonSerializer.SerializeToUtf8Bytes(
        result, (JsonTypeInfo<ExecutionResult>)Options.GetTypeInfo(typeof(ExecutionResult)));

    private sealed record ResultTypes : IJsonTypeInfoResolver
    {
        public JsonTypeInfo? GetTypeInfo(Type type, JsonSerializerOptions options)
        {
            if (type == typeof(object)) return JsonMetadataServices.CreateValueInfo<object>(
                options, new GraphqlValueConverter());
            if (type == typeof(ExecutionResult)) return JsonMetadataServices.CreateValueInfo<ExecutionResult>(
                options, new ExecutionResultJsonConverter());
            if (type == typeof(ExecutionErrors)) return JsonMetadataServices.CreateValueInfo<ExecutionErrors>(
                options, new ErrorsConverter());
            return ((IJsonTypeInfoResolver)GraphqlValueJson.Default).GetTypeInfo(type, options);
        }
    }

    private sealed class ErrorsConverter : JsonConverter<ExecutionErrors>
    {
        private readonly ExecutionErrorJsonConverter errorConverter = new(new ContractErrors());

        public override void Write(Utf8JsonWriter writer, ExecutionErrors errors, JsonSerializerOptions options)
        {
            writer.WriteStartArray();
            foreach (var error in errors) errorConverter.Write(writer, error, options);
            writer.WriteEndArray();
        }

        public override ExecutionErrors Read(ref Utf8JsonReader reader, Type typeToConvert,
            JsonSerializerOptions options) => throw new NotSupportedException("Execution errors are output only.");
    }

    private sealed record ContractErrors : IErrorInfoProvider
    {
        private readonly ErrorInfoProvider provider = new(new ErrorInfoProviderOptions { ExposeCodes = false, ExposeData = false });

        public ErrorInfo GetInfo(ExecutionError error)
        {
            var info = provider.GetInfo(error);
            var code = error switch
            {
                InvalidVariableError => "BAD_USER_INPUT",
                SyntaxError => "GRAPHQL_PARSE_FAILED",
                ValidationError when error.Code != "METHOD_NOT_ALLOWED" => "GRAPHQL_VALIDATION_FAILED",
                _ => error.Code ?? "INTERNAL_SERVER_ERROR"
            };
            if (code is not null)
            {
                info.Extensions ??= new Dictionary<string, object?>();
                info.Extensions["code"] = code;
            }
            return info;
        }
    }
}

[JsonSourceGenerationOptions(GenerationMode = JsonSourceGenerationMode.Metadata)]
[JsonSerializable(typeof(object))]
[JsonSerializable(typeof(string))]
[JsonSerializable(typeof(int))]
[JsonSerializable(typeof(long))]
[JsonSerializable(typeof(float))]
[JsonSerializable(typeof(double))]
[JsonSerializable(typeof(decimal))]
[JsonSerializable(typeof(bool))]
[JsonSerializable(typeof(string[]))]
[JsonSerializable(typeof(object[]))]
[JsonSerializable(typeof(System.Collections.IEnumerable))]
[JsonSerializable(typeof(IEnumerable<object>))]
[JsonSerializable(typeof(IDictionary<string, object>))]
[JsonSerializable(typeof(Dictionary<string, object>))]
internal partial class GraphqlValueJson : JsonSerializerContext;

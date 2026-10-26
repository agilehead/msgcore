using System.Collections;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace MsgCore.AdapterGraphql;

internal sealed class GraphqlValueConverter : JsonConverter<object>
{
    public override void Write(Utf8JsonWriter writer, object value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case null: writer.WriteNullValue(); break;
            case string text: writer.WriteStringValue(text); break;
            case bool boolean: writer.WriteBooleanValue(boolean); break;
            case byte number: writer.WriteNumberValue(number); break;
            case short number: writer.WriteNumberValue(number); break;
            case int number: writer.WriteNumberValue(number); break;
            case long number: writer.WriteNumberValue(number); break;
            case float number: writer.WriteNumberValue(number); break;
            case double number: writer.WriteNumberValue(number); break;
            case decimal number: writer.WriteNumberValue(number); break;
            case JsonElement element: element.WriteTo(writer); break;
            case JsonNode node: node.WriteTo(writer); break;
            case IDictionary<string, object?> dictionary:
                writer.WriteStartObject();
                foreach (var pair in dictionary)
                {
                    writer.WritePropertyName(pair.Key);
                    Write(writer, pair.Value!, options);
                }
                writer.WriteEndObject();
                break;
            case IEnumerable array:
                writer.WriteStartArray();
                foreach (var item in array) Write(writer, item!, options);
                writer.WriteEndArray();
                break;
            default:
                throw new NotSupportedException("GraphQL results must contain only the declared JSON wire values.");
        }
    }

    public override object Read(ref Utf8JsonReader reader, Type typeToConvert,
        JsonSerializerOptions options) => throw new NotSupportedException("GraphQL result values are output only.");
}

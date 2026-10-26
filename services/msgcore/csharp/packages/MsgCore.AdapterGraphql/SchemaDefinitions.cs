using System.Globalization;
using System.Reflection;
using GraphQL;
using GraphQL.Resolvers;
using GraphQL.Types;
using GraphQLParser;
using GraphQLParser.AST;

namespace MsgCore.AdapterGraphql;

public static class SchemaDefinitions
{
    public static ISchema Build(string audience,
        Func<IResolveFieldContext, ValueTask<object?>> resolve)
    {
        var assembly = typeof(SchemaDefinitions).Assembly;
        var sources = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(audience + ".", StringComparison.Ordinal))
            .Order(StringComparer.Ordinal)
            .Select(name => ReadResource(assembly, name));
        var document = Parser.Parse(string.Join("\n", sources));
        var types = new Dictionary<string, IGraphType>(StringComparer.Ordinal)
        {
            ["String"] = new StringGraphType(),
            ["ID"] = new IdGraphType(),
            ["Int"] = new IntGraphType(),
            ["Float"] = new FloatGraphType(),
            ["Boolean"] = new BooleanGraphType()
        };
        foreach (var definition in document.Definitions.OfType<GraphQLTypeDefinition>())
        {
            var name = definition.Name.StringValue;
            types.Add(name, definition switch
            {
                GraphQLObjectTypeDefinition => new ObjectGraphType { Name = name },
                GraphQLScalarTypeDefinition => new StringGraphType { Name = name },
                GraphQLInputObjectTypeDefinition => new InputObjectGraphType { Name = name },
                GraphQLEnumTypeDefinition => new EnumerationGraphType { Name = name },
                GraphQLUnionTypeDefinition => new UnionGraphType { Name = name },
                _ => throw new InvalidOperationException($"Unsupported GraphQL contract definition: {name}")
            });
        }
        foreach (var definition in document.Definitions.OfType<GraphQLTypeDefinition>())
        {
            var target = types[definition.Name.StringValue];
            target.Description = definition.Description?.Value.ToString();
            if (definition is GraphQLObjectTypeDefinition objectDefinition)
            {
                var graph = (ObjectGraphType)target;
                foreach (var field in objectDefinition.Fields?.Items ?? [])
                {
                    var arguments = field.Arguments?.Items.Select(argument => new QueryArgument(
                        ResolveType(argument.Type, types))
                    {
                        Name = argument.Name.StringValue,
                        Description = argument.Description?.Value.ToString(),
                        DefaultValue = Literal(argument.DefaultValue)
                    }) ?? [];
                    graph.AddField(new FieldType
                    {
                        Name = field.Name.StringValue,
                        Description = field.Description?.Value.ToString(),
                        ResolvedType = ResolveType(field.Type, types),
                        Arguments = new QueryArguments(arguments),
                        Resolver = new ContractFieldResolver(resolve)
                    });
                }
            }
            else if (definition is GraphQLInputObjectTypeDefinition inputDefinition)
            {
                var graph = (InputObjectGraphType)target;
                foreach (var field in inputDefinition.Fields?.Items ?? [])
                    graph.AddField(new FieldType
                    {
                        Name = field.Name.StringValue,
                        Description = field.Description?.Value.ToString(),
                        ResolvedType = ResolveType(field.Type, types),
                        DefaultValue = Literal(field.DefaultValue)
                    });
            }
            else if (definition is GraphQLEnumTypeDefinition enumDefinition)
            {
                var graph = (EnumerationGraphType)target;
                foreach (var value in enumDefinition.Values?.Items ?? [])
                    graph.Add(value.Name.StringValue, value.Name.StringValue, value.Description?.Value.ToString());
            }
            else if (definition is GraphQLUnionTypeDefinition unionDefinition)
            {
                var graph = (UnionGraphType)target;
                foreach (var member in unionDefinition.Types?.Items ?? [])
                    graph.AddPossibleType((IObjectGraphType)types[member.Name.StringValue]);
                throw new InvalidOperationException("MsgCore has no union types.");
            }
        }
        var schema = new GraphQL.Types.Schema(new FuncServiceProvider(_ => null), false)
        {
            Query = (IObjectGraphType)types["Query"],
            Mutation = (IObjectGraphType)types["Mutation"]
        };
        schema.RegisterTypes(types.Values.ToArray());
        schema.Initialize();
        return schema;
    }

    private static IGraphType ResolveType(GraphQLType type,
        IReadOnlyDictionary<string, IGraphType> types) => type switch
        {
            GraphQLNonNullType required => new NonNullGraphType(ResolveType(required.Type, types)),
            GraphQLListType list => new ListGraphType(ResolveType(list.Type, types)),
            GraphQLNamedType named => types[named.Name.StringValue],
            _ => throw new InvalidOperationException("Unsupported GraphQL contract type.")
        };

    private static object? Literal(GraphQLValue? value) => value switch
    {
        null or GraphQLNullValue => null,
        GraphQLStringValue text => text.Value.ToString(),
        GraphQLIntValue integer => int.Parse(integer.Value.ToString(), CultureInfo.InvariantCulture),
        GraphQLFloatValue number => double.Parse(number.Value.ToString(), CultureInfo.InvariantCulture),
        GraphQLBooleanValue boolean => bool.Parse(boolean.Value.ToString()),
        GraphQLEnumValue enumeration => enumeration.Name.StringValue,
        GraphQLListValue list => (list.Values ?? []).Select(Literal).ToArray(),
        GraphQLObjectValue map => (map.Fields ?? []).ToDictionary(field => field.Name.StringValue,
            field => Literal(field.Value), StringComparer.Ordinal),
        _ => throw new InvalidOperationException("Unsupported GraphQL contract default.")
    };

    private static string ReadResource(Assembly assembly, string name)
    {
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Missing embedded GraphQL contract: {name}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private sealed record ContractFieldResolver(
        Func<IResolveFieldContext, ValueTask<object?>> Resolve) : IFieldResolver
    {
        public ValueTask<object?> ResolveAsync(IResolveFieldContext context) => Resolve(context);
    }
}

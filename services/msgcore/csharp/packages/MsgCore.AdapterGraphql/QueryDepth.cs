using GraphQL.Validation;
using GraphQLParser.AST;

namespace MsgCore.AdapterGraphql;

public sealed class QueryDepth(int maximum) : ValidationRuleBase
{
    public override ValueTask<INodeVisitor?> GetPreNodeVisitorAsync(ValidationContext context)
    {
        if (maximum < 1) throw new ArgumentOutOfRangeException(nameof(maximum));
        var fragments = context.Document.Definitions.OfType<GraphQLFragmentDefinition>()
            .ToDictionary(fragment => fragment.FragmentName.Name.StringValue, StringComparer.Ordinal);
        var depths = new Dictionary<string, int>(StringComparer.Ordinal);
        int Depth(GraphQLSelectionSet? selections, HashSet<string> visiting)
        {
            var deepest = 0;
            foreach (var selection in selections?.Selections ?? [])
            {
                var depth = selection switch
                {
                    GraphQLField field when field.Name.StringValue.StartsWith("__", StringComparison.Ordinal) => 0,
                    GraphQLField field => 1 + Depth(field.SelectionSet, visiting),
                    GraphQLInlineFragment inline => Depth(inline.SelectionSet, visiting),
                    GraphQLFragmentSpread spread => Fragment(spread.FragmentName.Name.StringValue, visiting),
                    _ => 0
                };
                deepest = Math.Max(deepest, depth);
            }
            return deepest;
        }
        int Fragment(string name, HashSet<string> visiting)
        {
            if (depths.TryGetValue(name, out var depth)) return depth;
            if (!fragments.TryGetValue(name, out var fragment) || !visiting.Add(name)) return 0;
            depth = Depth(fragment.SelectionSet, visiting);
            visiting.Remove(name);
            depths[name] = depth;
            return depth;
        }
        foreach (var operation in context.Document.Definitions.OfType<GraphQLOperationDefinition>())
        {
            var depth = Depth(operation.SelectionSet, new HashSet<string>(StringComparer.Ordinal));
            if (depth <= maximum) continue;
            var error = new ValidationError(context.Document.Source, "QUERY_TOO_DEEP",
                $"Query is too deeply nested ({depth} levels; the limit is {maximum}). Ask for less in one request.", operation)
            {
                Code = "GRAPHQL_VALIDATION_FAILED",
                Extensions = new Dictionary<string, object?> { ["depth"] = depth, ["maxDepth"] = maximum }
            };
            context.ReportError(error);
        }
        return ValueTask.FromResult<INodeVisitor?>(null);
    }
}

using GraphQL.Validation;
using GraphQLParser.AST;

namespace MsgCore.AdapterGraphql;

public sealed class ReadOnlyOperation(string? selectedOperation) : ValidationRuleBase
{
    public override ValueTask<INodeVisitor?> GetPreNodeVisitorAsync(ValidationContext context)
    {
        var operations = context.Document.Definitions.OfType<GraphQLOperationDefinition>().ToArray();
        var selected = selectedOperation is null ? operations.Length == 1 ? operations[0] : null
            : operations.FirstOrDefault(operation => operation.Name?.StringValue == selectedOperation);
        if (selected is not null && selected.Operation != OperationType.Query)
            context.ReportError(new ValidationError(context.Document.Source, "METHOD_NOT_ALLOWED",
                "GET requests only support query operations, not mutation operations.", selected) { Code = "METHOD_NOT_ALLOWED" });
        return ValueTask.FromResult<INodeVisitor?>(null);
    }
}

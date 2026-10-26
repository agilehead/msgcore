using GraphQL;
using GraphQL.Execution;

namespace MsgCore.AdapterGraphql;

public sealed class RepositoryExecuter : DocumentExecuter
{
    protected override IExecutionStrategy SelectExecutionStrategy(GraphQL.Execution.ExecutionContext context) =>
        SerialExecutionStrategy.Instance;
}

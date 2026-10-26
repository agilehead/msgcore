using MsgCore.AdapterSqlite.Entities;
using MsgCore.Kernel;

namespace MsgCore.AdapterSqlite;

public sealed record UnitOfWork(MsgCoreDbContext Database) : IUnitOfWork
{
    public Task<Result<T>> Run<T>(Func<CancellationToken, Task<Result<T>>> operation, CancellationToken cancellation) =>
        Storage.Transaction(Database, () => operation(cancellation), cancellation);
}

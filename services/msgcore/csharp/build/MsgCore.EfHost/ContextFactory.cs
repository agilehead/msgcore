using MsgCore.AdapterSqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Query;

namespace MsgCore.EfHost;

public sealed class MsgCoreDbContextFactory : IDesignTimeDbContextFactory<MsgCoreDbContext>
{
    public MsgCoreDbContext CreateDbContext(string[] arguments) => new(
        new DbContextOptionsBuilder<MsgCoreDbContext>().UseSqlite("Data Source=:memory:")
            .ReplaceService<IRelationalParameterBasedSqlProcessorFactory, PrecompiledSqlParameterFactory>()
            .ReplaceService<IQuerySqlGeneratorFactory, NativeSqlGeneratorFactory>().Options);
}

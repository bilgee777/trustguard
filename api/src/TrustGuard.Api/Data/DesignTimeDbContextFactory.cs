using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TrustGuard.Api.Data;

/// <summary>
/// Used by `dotnet ef` only. Generating a migration needs no live database; applying one reads
/// ConnectionStrings__Migrations (a direct, non-pooled connection) or falls back to ConnectionStrings__Default.
/// </summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Migrations")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? "Host=localhost;Port=5432;Database=trustguard;Username=trustguard;Password=trustguard_dev_password";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionStrings.Normalize(connection))
            .UseSnakeCaseNamingConvention()
            .Options;
        return new AppDbContext(options);
    }
}

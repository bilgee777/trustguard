using Microsoft.EntityFrameworkCore;
using TrustGuard.Engine;

namespace TrustGuard.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AnalysisRecord> Analyses => Set<AnalysisRecord>();

    /// <summary>Enums are stored as readable snake_case text, the same names the API uses, so SQL stays self-explanatory.</summary>
    private static void AsName<TEnum>(Microsoft.EntityFrameworkCore.Metadata.Builders.PropertyBuilder<TEnum> property, int maxLength)
        where TEnum : struct, Enum =>
        property.HasConversion(v => EngineJson.EnumName(v), s => EngineJson.ParseEnum<TEnum>(s, "database")).HasMaxLength(maxLength);

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>(e =>
        {
            e.ToTable("users", t => t.HasCheckConstraint("ck_users_retention_days", "retention_days BETWEEN 1 AND 3650"));
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Email).HasMaxLength(254);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.DisplayName).HasMaxLength(80);
            e.Property(x => x.PasswordHash).HasMaxLength(512);
            AsName(e.Property(x => x.HistoryMode), 20);
        });

        model.Entity<RefreshToken>(e =>
        {
            e.ToTable("refresh_tokens");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.TokenHash).HasMaxLength(64);
            e.Property(x => x.Version).IsRowVersion();
            e.HasIndex(x => x.TokenHash).IsUnique();
            e.HasIndex(x => x.FamilyId);
            e.HasIndex(x => new { x.UserId, x.ExpiresAt });
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        model.Entity<AnalysisRecord>(e =>
        {
            e.ToTable("analyses", t =>
            {
                t.HasCheckConstraint("ck_analyses_score", "score BETWEEN 0 AND 100");
                t.HasCheckConstraint("ck_analyses_confidence", "confidence_value BETWEEN 0 AND 100");
            });
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            AsName(e.Property(x => x.ContentType), 20);
            AsName(e.Property(x => x.Level), 20);
            AsName(e.Property(x => x.ConfidenceLevel), 20);
            e.Property(x => x.EngineVersion).HasMaxLength(20);
            e.Property(x => x.Categories).HasColumnType("text[]");
            e.Property(x => x.RuleIds).HasColumnType("text[]");
            e.Property(x => x.FindingTitles).HasMaxLength(4000);
            e.Property(x => x.ResultJson).HasColumnType("jsonb");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);

            // The history page lists a user's newest analyses first, optionally narrowed by risk level.
            e.HasIndex(x => new { x.UserId, x.CreatedAt }).IsDescending(false, true);
            e.HasIndex(x => new { x.UserId, x.Level, x.CreatedAt }).IsDescending(false, false, true);
            // The retention job deletes by expiry across all users.
            e.HasIndex(x => x.ExpiresAt);
        });
    }
}

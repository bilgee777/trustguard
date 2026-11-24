using Npgsql;
using TrustGuard.Api.Auth;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Tests;

public class ConnectionStringTests
{
    [Fact]
    public void ConvertsHostedProviderUrlsToNpgsqlSettings()
    {
        var builder = new NpgsqlConnectionStringBuilder(ConnectionStrings.Normalize(
            "postgresql://app_user:p%40ss%2Fw%3Ard@ep-cool-name-123.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"));

        Assert.Equal("ep-cool-name-123.eu-central-1.aws.neon.tech", builder.Host);
        Assert.Equal(5432, builder.Port);
        Assert.Equal("neondb", builder.Database);
        Assert.Equal("app_user", builder.Username);
        Assert.Equal("p@ss/w:rd", builder.Password);
        Assert.Equal(SslMode.Require, builder.SslMode);
        Assert.Equal(ChannelBinding.Require, builder.ChannelBinding);
    }

    [Fact]
    public void RemoteHostsDefaultToSslEvenWhenTheUrlOmitsIt() =>
        Assert.Equal(SslMode.Require, new NpgsqlConnectionStringBuilder(ConnectionStrings.Normalize("postgres://u:p@db.example.com:6543/app")).SslMode);

    [Fact]
    public void LocalHostsDoNotForceSsl() =>
        Assert.Equal(SslMode.Prefer, new NpgsqlConnectionStringBuilder(ConnectionStrings.Normalize("postgresql://u:p@localhost/app")).SslMode);

    [Fact]
    public void KeywordConnectionStringsPassThroughUnchanged()
    {
        const string keyword = "Host=localhost;Database=x;Username=u;Password=p";
        Assert.Equal(keyword, ConnectionStrings.Normalize(keyword));
    }

    [Fact]
    public void CustomPortsAreKept() =>
        Assert.Equal(6543, new NpgsqlConnectionStringBuilder(ConnectionStrings.Normalize("postgres://u:p@db.example.com:6543/app")).Port);
}

public class PasswordPolicyTests
{
    [Theory]
    [InlineData("correct horse battery staple", null)]
    [InlineData("short", "Use at least 10 characters.")]
    [InlineData("aaaaaaaaaaaa", "Use a password with more variety than repeated characters.")]
    [InlineData("Password123", "This password is too common. Choose something less guessable.")]
    public void AppliesTheDocumentedRules(string password, string? expected) =>
        Assert.Equal(expected, PasswordPolicy.Validate(password, "someone@example.com"));

    [Fact]
    public void RejectsPasswordsThatContainTheEmailName() =>
        Assert.NotNull(PasswordPolicy.Validate("ayse.yilmaz-2026", "ayse.yilmaz@example.com"));

    [Fact]
    public void RejectsPasswordsLongerThanTheLimit() =>
        Assert.NotNull(PasswordPolicy.Validate(new string('x', 129) + "yz12", "a@example.com"));

    [Theory]
    [InlineData("  Jane@Example.COM ", "jane@example.com")]
    [InlineData("not-an-email", null)]
    [InlineData("a@b", null)]
    [InlineData("Jane Doe <jane@example.com>", null)]
    [InlineData("", null)]
    public void NormalizesEmailAddresses(string input, string? expected) => Assert.Equal(expected, PasswordPolicy.NormalizeEmail(input));
}

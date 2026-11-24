using System.ComponentModel.DataAnnotations;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Auth;

public sealed class RegisterRequest
{
    [Required, StringLength(254)]
    public string Email { get; init; } = "";

    [Required, StringLength(PasswordPolicy.MaxLength)]
    public string Password { get; init; } = "";

    [Required, StringLength(80, MinimumLength = 1)]
    public string DisplayName { get; init; } = "";
}

public sealed class LoginRequest
{
    [Required, StringLength(254)]
    public string Email { get; init; } = "";

    [Required, StringLength(PasswordPolicy.MaxLength)]
    public string Password { get; init; } = "";
}

public sealed record SettingsDto(HistoryMode HistoryMode, int RetentionDays);

public sealed record UserDto(Guid Id, string Email, string DisplayName, SettingsDto Settings)
{
    public static UserDto From(User user) => new(user.Id, user.Email, user.DisplayName, new SettingsDto(user.HistoryMode, user.RetentionDays));
}

public sealed record CsrfResponse(string CsrfToken);

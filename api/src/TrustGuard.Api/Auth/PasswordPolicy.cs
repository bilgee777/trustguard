using System.Net.Mail;

namespace TrustGuard.Api.Auth;

public static class PasswordPolicy
{
    public const int MinLength = 10;
    public const int MaxLength = 128;

    /// <summary>A short list of the passwords attackers try first. A real deployment would check a breach corpus.</summary>
    private static readonly HashSet<string> Common = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password1", "password123", "1234567890", "12345678910", "qwertyuiop", "qwerty12345",
        "iloveyou123", "admin12345", "letmein123", "welcome123", "trustguard", "trustguard1",
    };

    /// <summary>Returns a user-facing problem, or null when the password is acceptable.</summary>
    public static string? Validate(string password, string email)
    {
        if (password.Length < MinLength) return $"Use at least {MinLength} characters.";
        if (password.Length > MaxLength) return $"Use at most {MaxLength} characters.";
        if (password.Distinct().Count() < 5) return "Use a password with more variety than repeated characters.";
        if (Common.Contains(password)) return "This password is too common. Choose something less guessable.";

        var local = email.Split('@')[0];
        if (local.Length >= 4 && password.Contains(local, StringComparison.OrdinalIgnoreCase)) return "Do not include your email address in your password.";
        return null;
    }

    /// <summary>Lower-cases and trims; returns null when the address is not a plausible email.</summary>
    public static string? NormalizeEmail(string? value)
    {
        var email = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || email.Length > 254) return null;
        return MailAddress.TryCreate(email, out var parsed) && string.Equals(parsed.Address, email, StringComparison.Ordinal) && email.Contains('.', StringComparison.Ordinal)
            ? email
            : null;
    }
}

using System.Text.Json;
using System.Text.Json.Serialization;

namespace TrustGuard.Engine;

/// <summary>
/// JSON contract shared with the web app: camelCase properties and snake_case enum values
/// ("job_offer", "suspicious_link"), identical to the TypeScript engine's types.
/// </summary>
public static class EngineJson
{
    public static JsonSerializerOptions Options { get; } = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        };
        options.MakeReadOnly(populateMissingResolver: true);
        return options;
    }

    public static string EnumName<T>(T value) where T : struct, Enum =>
        JsonNamingPolicy.SnakeCaseLower.ConvertName(value.ToString());

    public static T ParseEnum<T>(string value, string context) where T : struct, Enum
    {
        foreach (var candidate in Enum.GetValues<T>())
        {
            if (string.Equals(EnumName(candidate), value, StringComparison.Ordinal)) return candidate;
        }
        throw new InvalidDataException($"{context}: unknown {typeof(T).Name} \"{value}\".");
    }
}

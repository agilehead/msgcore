using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MsgCore.AdapterAuth;

public sealed record Identity(string UserId, string? Tenant);

public static class Tokens
{
    public static Identity? Verify(string token, string secret, DateTimeOffset now)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 3) return null;
            using var header = JsonDocument.Parse(Decode(parts[0]));
            var bytes = Encoding.ASCII.GetBytes(parts[0] + "." + parts[1]);
            var key = Encoding.UTF8.GetBytes(secret);
            var signature = header.RootElement.GetProperty("alg").GetString() switch
            {
                "HS256" => HMACSHA256.HashData(key, bytes),
                "HS384" => HMACSHA384.HashData(key, bytes),
                "HS512" => HMACSHA512.HashData(key, bytes),
                _ => null
            };
            if (signature is null || !CryptographicOperations.FixedTimeEquals(signature, Decode(parts[2]))) return null;
            using var payload = JsonDocument.Parse(Decode(parts[1]));
            var claims = payload.RootElement;
            if (claims.ValueKind != JsonValueKind.Object) return null;
            if (claims.TryGetProperty("exp", out var exp) && now.ToUnixTimeSeconds() >= exp.GetDouble()) return null;
            if (claims.TryGetProperty("nbf", out var nbf) && now.ToUnixTimeSeconds() < nbf.GetDouble()) return null;
            var id = Text(claims, "userId") ?? Text(claims, "sub");
            return id is null ? null : new Identity(id, Text(claims, "tenant"));
        }
        catch (Exception error) when (error is JsonException or FormatException or InvalidOperationException or KeyNotFoundException)
        { return null; }
    }

    private static string? Text(JsonElement claims, string name) => claims.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static byte[] Decode(string value)
    {
        if (value.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '-' and not '_'))
            throw new FormatException("Invalid base64url");
        return Convert.FromBase64String(value.Replace('-', '+').Replace('_', '/').PadRight((value.Length + 3) / 4 * 4, '='));
    }
}

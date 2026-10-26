namespace MsgCore.AdapterRuntime;

public sealed record Settings(string Host, int Port, string DatabasePath, string InternalSecret,
    string JwtSecret, string[] CorsOrigins, bool Production)
{
    public static Settings Read() => new(Required("MSGCORE_SERVER_HOST"), Number("MSGCORE_SERVER_PORT", 5007),
        Path.GetFullPath(Path.Combine(Required("MSGCORE_DATA_DIR"), "msgcore.db")), Required("MSGCORE_INTERNAL_SECRET"),
        Required("MSGCORE_JWT_SECRET"), Required("MSGCORE_CORS_ORIGINS").Split(',').Select(value => value.Trim()).ToArray(),
        Environment.GetEnvironmentVariable("NODE_ENV") == "production");

    public static string Required(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
        ? value : throw new ArgumentException("Required environment variable " + name + " is not set");

    public static int Number(string name, int fallback) =>
        Environment.GetEnvironmentVariable(name) is not { Length: > 0 } text ? fallback
        : int.TryParse(text, out var value) && value > 0 && value <= 65535 ? value : throw new ArgumentException("Invalid " + name);
}

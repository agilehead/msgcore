using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MsgCore.AdapterAuth;
using MsgCore.AdapterGraphql;
using MsgCore.AdapterRuntime;
using MsgCore.AdapterSqlite;
using MsgCore.Kernel;

namespace MsgCore.AdapterHttp;

public static class Host
{
    public static async Task<int> Run(string[] arguments)
    {
        if (arguments.SequenceEqual(["health"]))
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            try { return (await client.GetAsync("http://127.0.0.1:" + Settings.Number("MSGCORE_SERVER_PORT", 5007) + "/health")).IsSuccessStatusCode ? 0 : 1; }
            catch (HttpRequestException) { return 1; }
        }
        var settings = Settings.Read();
        Storage.Initialize(settings.DatabasePath);
        var builder = WebApplication.CreateSlimBuilder(arguments);
        builder.Logging.SetMinimumLevel(Logging.Minimum(Environment.GetEnvironmentVariable("LOG_LEVEL")));
        builder.WebHost.UseUrls($"http://{settings.Host}:{settings.Port}");
        builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
            policy.WithOrigins(settings.CorsOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
        var app = builder.Build();
        var clock = new Clock(() => DateTimeOffset.UtcNow);
        var schema = Schema.Create();
        app.UseCors();
        app.Use(async (context, next) =>
        {
            GraphqlEndpoint.Limit(context, 1024 * 1024);
            try { await next(context); }
            catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
            catch (BadHttpRequestException error)
            {
                if (!context.Response.HasStarted) await GraphqlEndpoint.Error(context, error.StatusCode, "Invalid request body", "BAD_REQUEST");
            }
            catch (JsonException)
            {
                context.Response.StatusCode = 400;
                await GraphqlEndpoint.Json(context, new JsonObject { ["error"] = "Invalid request body" });
            }
            catch (Exception error)
            {
                app.Logger.LogError(error, "MsgCore request failed");
                context.Response.StatusCode = 500;
                await GraphqlEndpoint.Json(context, new JsonObject { ["error"] = "Internal server error", ["message"] = error.Message });
            }
        });
        app.MapGet("/health", context => GraphqlEndpoint.Json(context, new JsonObject { ["status"] = "ok" }));
        app.Map("/graphql", async context =>
        {
            var request = await GraphqlEndpoint.Read(context);
            if (request is null) return;
            await using var db = Storage.Open(settings.DatabasePath);
            var identity = Identity(context, settings.JwtSecret, clock.UtcNow());
            await GraphqlEndpoint.Execute(context, schema, request, Session(db, clock, identity?.UserId), int.MaxValue, !settings.Production);
        });
        app.Map("/internal/{**path}", async context =>
        {
            if (context.Request.Headers.Authorization != "Bearer " + settings.InternalSecret)
            {
                context.Response.StatusCode = 401;
                await GraphqlEndpoint.Json(context, new JsonObject { ["error"] = "Unauthorized" });
                return;
            }
            await using var db = Storage.Open(settings.DatabasePath);
            await InternalRoutes.Handle(context, Session(db, clock, null));
        });
        await app.RunAsync();
        return 0;
    }

    private static RequestSession Session(MsgCoreDbContext db, Clock clock, string? userId) => new(
        AdapterSqlite.Conversations.Conversations.Create(db, clock), AdapterSqlite.Messages.Messages.Create(db, clock),
        AdapterSqlite.Activity.Activities.Create(db, clock), new UnitOfWork(db), clock, userId);

    private static AdapterAuth.Identity? Identity(HttpContext context, string secret, DateTimeOffset now)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        var identity = authorization.StartsWith("Bearer ", StringComparison.Ordinal)
            ? Tokens.Verify(authorization[7..], secret, now) : null;
        return identity ?? (context.Request.Cookies.TryGetValue("access_token", out var cookie) ? Tokens.Verify(cookie, secret, now) : null);
    }
}

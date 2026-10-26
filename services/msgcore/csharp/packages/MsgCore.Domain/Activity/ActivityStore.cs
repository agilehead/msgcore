using MsgCore.Kernel;

namespace MsgCore.Domain.Activity;

public sealed record Activity(string UserId, string? LastSeenAt, string UpdatedAt);
public sealed record ActivityStore(
    Func<string, CancellationToken, Task<Result<Activity?>>> Find,
    Func<string, string, CancellationToken, Task<Result<Unit>>> MarkAllSeen,
    Func<string, CancellationToken, Task<Result<int>>> CountNew);

using System.Security.Cryptography;

namespace MsgCore.Kernel;

public static class Ids
{
    public static string New() => Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(8));
}

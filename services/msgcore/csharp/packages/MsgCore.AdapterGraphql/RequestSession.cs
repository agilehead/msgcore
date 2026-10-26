using MsgCore.Domain.Conversations;
using MsgCore.Domain.Messages;
using MsgCore.Domain.Activity;
using MsgCore.Kernel;

namespace MsgCore.AdapterGraphql;

public sealed record RequestSession(ConversationStore Conversations, MessageStore Messages, ActivityStore Activity,
    IUnitOfWork UnitOfWork, Clock Clock, string? UserId);

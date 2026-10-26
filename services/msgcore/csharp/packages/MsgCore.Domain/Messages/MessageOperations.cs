using MsgCore.Domain.Conversations;
using MsgCore.Kernel;

namespace MsgCore.Domain.Messages;

public static class MessageOperations
{
    public static async Task<Result<Message>> SendByParticipant(ConversationStore conversations, MessageStore messages,
        IUnitOfWork unit, string conversationId, string senderId, string body, string? metadata, string? replyTo,
        CancellationToken cancellation)
    {
        var participant = await conversations.Participant(conversationId, senderId, cancellation);
        if (!participant.IsSuccess) return Result<Message>.Failed(participant.Error!);
        if (participant.Value is null) return Result<Message>.Failed("FORBIDDEN", "Not a participant in this conversation");
        return await Send(conversations, messages, unit, conversationId, senderId, body, metadata, replyTo, cancellation);
    }

    public static Task<Result<Message>> Send(ConversationStore conversations, MessageStore messages,
        IUnitOfWork unit, string conversationId, string senderId, string body, string? metadata, string? replyTo,
        CancellationToken cancellation) => unit.Run(async ct =>
        {
            var conversation = await conversations.Find(conversationId, ct);
            if (!conversation.IsSuccess) return Result<Message>.Failed(conversation.Error!);
            if (conversation.Value is null) return Result<Message>.Failed("NOT_FOUND", "Conversation not found");
            var message = await messages.Create(new MessageInput(Ids.New(), conversationId, senderId, body, metadata, replyTo), ct);
            if (!message.IsSuccess) return message;
            var touched = await conversations.Touch(conversationId, message.Value.CreatedAt, ct);
            return touched.IsSuccess ? message : Result<Message>.Failed(touched.Error!);
        }, cancellation);

    public static async Task<Result<Unit>> DeleteOwn(MessageStore messages, string messageId, string userId,
        CancellationToken cancellation)
    {
        var message = await messages.Find(messageId, cancellation);
        if (!message.IsSuccess) return Result<Unit>.Failed(message.Error!);
        if (message.Value is null) return Result<Unit>.Failed("NOT_FOUND", "Message not found");
        return message.Value.SenderId != userId
            ? Result<Unit>.Failed("FORBIDDEN", "Only the sender can delete their message")
            : await messages.Delete(messageId, null, cancellation);
    }
}

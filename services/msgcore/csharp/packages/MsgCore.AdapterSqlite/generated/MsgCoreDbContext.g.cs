#nullable enable

using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using MsgCore.AdapterSqlite.Entities;

namespace MsgCore.AdapterSqlite;

public sealed partial class MsgCoreDbContext : DbContext
{
    [UnconditionalSuppressMessage("Trimming", "IL2026", Justification = "Native publishing generates the EF compiled model and query interceptors; the native contract suite exercises them.")]
    [UnconditionalSuppressMessage("AOT", "IL3050", Justification = "Native publishing generates the EF compiled model and query interceptors; the native contract suite exercises them.")]
    public MsgCoreDbContext(DbContextOptions<MsgCoreDbContext> options) : base(options) { }

    public DbSet<ConversationRow> Conversation => Set<ConversationRow>();
    public DbSet<ConversationParticipantRow> ConversationParticipant => Set<ConversationParticipantRow>();
    public DbSet<MessageRow> Message => Set<MessageRow>();
    public DbSet<UserActivityRow> UserActivity => Set<UserActivityRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ConversationRow>(entity =>
        {
            entity.ToTable("conversation");
            entity.HasKey(row => new { row.Id });
            entity.Property(row => row.Id).HasColumnName("id");
            entity.Property(row => row.ContextType).HasColumnName("context_type");
            entity.Property(row => row.ContextId).HasColumnName("context_id");
            entity.Property(row => row.Title).HasColumnName("title");
            entity.Property(row => row.CreatedBy).HasColumnName("created_by");
            entity.Property(row => row.LastMessageAt).HasColumnName("last_message_at");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
        });
        modelBuilder.Entity<ConversationParticipantRow>(entity =>
        {
            entity.ToTable("conversation_participant");
            entity.HasKey(row => new { row.ConversationId, row.UserId });
            entity.Property(row => row.ConversationId).HasColumnName("conversation_id");
            entity.Property(row => row.UserId).HasColumnName("user_id");
            entity.Property(row => row.DisplayName).HasColumnName("display_name");
            entity.Property(row => row.LastSeenAt).HasColumnName("last_seen_at");
            entity.HasOne<ConversationRow>().WithMany().HasForeignKey(row => row.ConversationId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<MessageRow>(entity =>
        {
            entity.ToTable("message");
            entity.HasKey(row => new { row.Id });
            entity.Property(row => row.Id).HasColumnName("id");
            entity.Property(row => row.ConversationId).HasColumnName("conversation_id");
            entity.Property(row => row.SenderId).HasColumnName("sender_id");
            entity.Property(row => row.Body).HasColumnName("body");
            entity.Property(row => row.Metadata).HasColumnName("metadata");
            entity.Property(row => row.ReplyTo).HasColumnName("reply_to");
            entity.Property(row => row.IsDeleted).HasColumnName("is_deleted");
            entity.Property(row => row.DeletedReason).HasColumnName("deleted_reason");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasOne<ConversationRow>().WithMany().HasForeignKey(row => row.ConversationId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<UserActivityRow>(entity =>
        {
            entity.ToTable("user_activity");
            entity.HasKey(row => new { row.UserId });
            entity.Property(row => row.UserId).HasColumnName("user_id");
            entity.Property(row => row.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
        });
    }
}

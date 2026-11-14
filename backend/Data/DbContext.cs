using App.Models;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace App.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<RefreshToken> RefreshTokens { get; set; }
        public DbSet<Friendship> Friendships { get; set; }

        public DbSet<AnalysisTask> AnalysisTasks { get; set; }
        public DbSet<SavedGame> SavedGames { get; set; }



        protected override void OnModelCreating(ModelBuilder modelBuilder)

        {

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);

                entity.HasIndex(u => u.Username)
                    .IsUnique();

            });
            modelBuilder.Entity<RefreshToken>(entity =>
            {

                entity.HasKey(r => r.Id);

                entity.Property(r => r.Token)
                    .IsRequired()
                    .HasMaxLength(256);


                entity.HasIndex(r => r.Token)
                    .IsUnique();

                entity.HasOne(r => r.User)
                    .WithMany()
                    .HasForeignKey(r => r.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.Ignore(r => r.IsExpired);
                entity.Ignore(r => r.IsActive);
            });

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.User)
                .WithMany(u => u.SentFriendRequests)
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
                .HasOne(f => f.Friend)
                .WithMany(u => u.ReceivedFriendRequests)
                .HasForeignKey(f => f.FriendId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Friendship>()
            .HasIndex(f => new { f.UserId, f.FriendId })
            .IsUnique();

            modelBuilder.Entity<AnalysisTask>(entity =>
            {
                entity.HasIndex(a => a.Id);

                entity.HasOne(a => a.User)
                    .WithMany()
                    .HasForeignKey(a => a.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

            });

            modelBuilder.Entity<SavedGame>(entity =>
            {
                entity.HasIndex(s => s.Id);

                entity.HasOne(s => s.User)
                    .WithMany()
                    .HasForeignKey(s => s.UserId)
                    .OnDelete(DeleteBehavior.Cascade);


            });
        }
    }

}
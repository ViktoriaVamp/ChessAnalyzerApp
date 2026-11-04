namespace App.Models
{
    public class Friendship
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User User { get; set; }

        public int FriendId { get; set; }
        public User Friend { get; set; }

        public FriendStatus Status { get; set; } 
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public enum FriendStatus
    {
        Pending,
        Accepted,
        Blocked
    }
}

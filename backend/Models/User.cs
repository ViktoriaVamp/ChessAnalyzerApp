using System.ComponentModel.DataAnnotations;

namespace App.Models
{
    public class User
    {
        public int Id { get; set; }

        [MaxLength(50)] public string Username { get; set; } = "";

        [MaxLength(60)] public string PasswordHash { get; set; } = "";

        [MaxLength(50)] public string Email { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsDeleted { get; set; } = false;
    }
}

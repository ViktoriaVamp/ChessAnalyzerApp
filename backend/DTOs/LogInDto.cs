using System.ComponentModel.DataAnnotations;

namespace App.DTOs
{
    public class LogInDto
    {
        [Required(ErrorMessage = "Please enter your email or nickname")]
        [MaxLength(50, ErrorMessage = "Login field cannot exceed 50 characters")]
        public string Login { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please enter password")]
        [StringLength(20, MinimumLength = 6, ErrorMessage = "Password must be between 6 and 20 characters")]

        public string Password { get; set; } = string.Empty;
    }
}

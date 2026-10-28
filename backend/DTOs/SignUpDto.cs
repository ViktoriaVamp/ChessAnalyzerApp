using System.ComponentModel.DataAnnotations;

namespace App.DTOs
{
    public class SignUpDto
    {
        [Required(ErrorMessage = "Please enter nickname")]
        [RegularExpression(@"^[a-z0-9_]+$",
     ErrorMessage = "Nickname can contain only numbers, lowercase and _")]
        [MaxLength(50, ErrorMessage = "Nickname field can't contain more than 50 symbols")]
        public string Username { get; set; } = "";


        [Required(ErrorMessage = "Please enter password")]
        [StringLength(20, MinimumLength = 6,
         ErrorMessage = "Password must be between 6 and 20 characters")]
        [RegularExpression(@"^\S+$",
          ErrorMessage = "Password cannot contain spaces")]
        public string Password { get; set; } = "";


        [Required(ErrorMessage = "Please enter email")]
        [RegularExpression(@"^[^@\s]+@[^@\s]+\.[^@\s]+$",
            ErrorMessage = "Invalid email address")]
        [MaxLength(50, ErrorMessage = "Email field cannot exceed 50 characters")]
        public string Email { get; set; } = string.Empty;
    }
}

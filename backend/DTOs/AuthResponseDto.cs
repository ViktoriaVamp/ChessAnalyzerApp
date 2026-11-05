using App.Models;

namespace App.DTOs
{
    public record AuthResponseDto(string AccessToken, RefreshToken RefreshToken);
}

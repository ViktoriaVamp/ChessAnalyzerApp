using App.Templates;
using App.DTOs;
using App.Models;

namespace App.Services
{
    public interface IAuthService
    {
        string GenerateJwtToken(User user);
        Task<Result<AuthResponseDto>> SignUpAsync(SignUpDto dto);
        Task<Result<AuthResponseDto>> LoginAsync(LogInDto dto);
        Task<Result<AuthResponseDto>> RefreshTokenAsync(string token);
        Task<Result<bool>> RevokeRefreshTokenAsync(string refreshToken);
    }
}
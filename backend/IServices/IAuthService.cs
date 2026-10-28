using App.Models;
using App.DTOs;
namespace App.Services
{

    public interface IAuthService
    {
        string GenerateJwtToken(User user);
        Task<(bool success, string? accessToken, RefreshToken? newRefreshToken, string? message)> RefreshTokenAsync(string token);
        Task<(bool success, string? accessToken, RefreshToken? refreshToken, string? result, string? field)> SignUpAsync(SignUpDto dto);
        Task<(bool success, string? accessToken, RefreshToken? refreshToken, string? result)> LoginAsync(LogInDto dto);
        Task<(bool success, string? result)> RevokeRefreshTokenAsync(string refreshToken);

    }

}
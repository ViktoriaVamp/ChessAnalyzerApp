using App.Data;
using App.DTOs;
using App.Models;
using App.Services;
using App.Templates;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace App.Services
{
    public class AuthService : IAuthService
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _configuration;
        public AuthService(ApplicationDbContext db, IConfiguration configuration)
        {
            _db = db;
            _configuration = configuration;
        }

        public string GenerateJwtToken(User user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!);

            var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, "User")
        };

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddMinutes(double.Parse(_configuration["Jwt:DurationInMinutes"]!)),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        private RefreshToken GenerateRefreshToken(int userId)
        {
            var randomBytes = new byte[64];
            RandomNumberGenerator.Fill(randomBytes);

            return new RefreshToken
            {
                UserId = userId,
                Token = Convert.ToBase64String(randomBytes),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow
            };
        }


        public async Task<Result<AuthResponseDto>> SignUpAsync(SignUpDto dto)
        {
            var existingUser = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Username == dto.Username || u.Email == dto.Email);

            if (existingUser != null)
            {
                if (existingUser.Username == dto.Username)
                    return Result<AuthResponseDto>.Failure("Цей нік уже зайнятий", "username");

                if (existingUser.Email == dto.Email)
                    return Result<AuthResponseDto>.Failure("Цей імейл уже існує", "email");
            }

            var user = new User
            {
                Username = dto.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Email = dto.Email
            };

            _db.Users.Add(user);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Result<AuthResponseDto>.Failure("Помилка доступу. Try again");
            }
            catch (Exception)
            {
                return Result<AuthResponseDto>.Failure("Помилка сервера. Try again");
            }

            var accessToken = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken(user.Id);

            _db.RefreshTokens.Add(refreshToken);
            await _db.SaveChangesAsync();

            return Result<AuthResponseDto>.Success(new AuthResponseDto(accessToken, refreshToken));
        }


        public async Task<Result<AuthResponseDto>> LoginAsync(LogInDto dto)
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Email == dto.Login || u.Username == dto.Login);

            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                return Result<AuthResponseDto>.Failure("Неправильний пароль або логін");
            }

            var accessToken = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken(user.Id);

            _db.RefreshTokens.Add(refreshToken);
            await _db.SaveChangesAsync();

            return Result<AuthResponseDto>.Success(new AuthResponseDto(accessToken, refreshToken));
        }


        public async Task<Result<AuthResponseDto>> RefreshTokenAsync(string token)
        {
            var refreshToken = await _db.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == token);

            if (refreshToken == null || !refreshToken.IsActive)
            {
                return Result<AuthResponseDto>.Failure("Неправильний або просрочений токен");
            }

            refreshToken.RevokedAt = DateTime.UtcNow;

            var newAccessToken = GenerateJwtToken(refreshToken.User);
            var newRefreshToken = GenerateRefreshToken(refreshToken.User.Id);

            _db.RefreshTokens.Add(newRefreshToken);
            await _db.SaveChangesAsync();

            return Result<AuthResponseDto>.Success(new AuthResponseDto(newAccessToken, newRefreshToken));
        }


        public async Task<Result<bool>> RevokeRefreshTokenAsync(string refreshToken)
        {
            var token = await _db.RefreshTokens
                .FirstOrDefaultAsync(t => t.Token == refreshToken);

            if (token == null || !token.IsActive)
            {
                return Result<bool>.Failure("Помилка");
            }

            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return Result<bool>.Success(true);
        }
    }
}

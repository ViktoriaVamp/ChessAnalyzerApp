using App.Data;
using App.Models;
using App.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using App.DTOs;

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
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);

            return new RefreshToken
            {
                UserId = userId,
                Token = Convert.ToBase64String(randomBytes),
                ExpiresAt = DateTime.UtcNow.AddDays(30),
                CreatedAt = DateTime.UtcNow
            };
        }

        public async Task<(bool success, string? accessToken, RefreshToken? refreshToken, string? result, string? field)> SignUpAsync(SignUpDto dto)
        {
            var existingUser = await _db.Users
         .FirstOrDefaultAsync(u => u.Username == dto.Username || u.Email == dto.Email);

            if (existingUser != null)
            {
                if (existingUser.Username == dto.Username)
                    return (false, null, null, "This username is already taken", "username");

                if (existingUser.Email == dto.Email)
                    return (false, null, null, "This email is already registered", "email");
            }


            string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var user = new User
            {
                Username = dto.Username,

                PasswordHash = passwordHash,

                Email = dto.Email,

            };

            _db.Users.Add(user);

            try
            {

                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                return (false, null, null, "An error occurred while accessing the database. Try again", null);
            }
            catch (Exception ex)
            {
                return (false, null, null, "An server error occurred. Try again", null);
            }
            var accessToken = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken(user.Id);

            _db.RefreshTokens.Add(refreshToken);


            await _db.SaveChangesAsync();

            return (true, accessToken, refreshToken, "Sign Up Successful", null);
        }

        public async Task<(bool success, string? accessToken, RefreshToken? refreshToken, string? result)> LoginAsync(LogInDto dto)
        {
            var user = await _db.Users
        .FirstOrDefaultAsync(u => u.Email == dto.Login || u.Username == dto.Login);

            if (user == null)
            {
                return (false, null, null, "Invalid email/nickname or password");
            }
            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);

            if (!isPasswordValid)
            {
                return (false, null, null, "Invalid password");
            }

            var accessToken = GenerateJwtToken(user);
            var refreshToken = GenerateRefreshToken(user.Id);

            _db.RefreshTokens.Add(refreshToken);
            await _db.SaveChangesAsync();

            return (true, accessToken, refreshToken, "Login Successful");
        }

        public async Task<(bool success, string? accessToken, RefreshToken? newRefreshToken, string? message)> RefreshTokenAsync(string token)
        {
            var refreshToken = await _db.RefreshTokens
                .Include(r => r.User)
                .FirstOrDefaultAsync(r => r.Token == token);

            if (refreshToken == null || !refreshToken.IsActive)
            {
                return (false, null, null, "Invalid or expired refresh token");
            }


            refreshToken.RevokedAt = DateTime.UtcNow;

            var newAccessToken = GenerateJwtToken(refreshToken.User);
            var newRefreshToken = GenerateRefreshToken(refreshToken.User.Id);

            _db.RefreshTokens.Add(newRefreshToken);
            await _db.SaveChangesAsync();

            return (true, newAccessToken, newRefreshToken, "Token refreshed successfully");
        }

        public async Task<(bool success, string? result)> RevokeRefreshTokenAsync(string refreshToken)
        {

            var token = await _db.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == refreshToken);

            if (token == null || !token.IsActive)
            {
                return (false, "Issue with logging out occured");
            }


            token.RevokedAt = DateTime.UtcNow;


            await _db.SaveChangesAsync();

            return (true, "Log out successfully");
        }

    }

}

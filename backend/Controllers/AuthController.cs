
using App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using App.DTOs;
namespace App.Controllers
{

    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;

        }


        [HttpPost("sign-up")]
        public async Task<IActionResult> SignUp([FromBody] SignUpDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var (success, accessToken, refreshToken, result, field) = await _authService.SignUpAsync(dto);

            if (!success)
                return Conflict(new { field, message = result }); 

            SetRefreshTokenCookie(refreshToken!.Token, refreshToken.ExpiresAt);

            return Ok(new
            {
                message = "Sig Up Successful",
                token = accessToken
            });

        }


        [HttpPost("log-in")]
        public async Task<IActionResult> Login([FromBody] LogInDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var (success, accessToken, refreshToken, result) = await _authService.LoginAsync(dto);

            if (!success)
                return Unauthorized(new { message = result });

            SetRefreshTokenCookie(refreshToken!.Token, refreshToken.ExpiresAt);

            return Ok(new
            {
                message = "Log In Successful",
                token = accessToken
            });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {

            var refreshToken = Request.Cookies["refreshToken"];

            if (string.IsNullOrEmpty(refreshToken))
                return Unauthorized(new { message = "Refresh token is missing" });

            var (success, newAccessToken, newRefreshToken, message) = await _authService.RefreshTokenAsync(refreshToken);

            if (!success)
                return Unauthorized(new { message });

            SetRefreshTokenCookie(newRefreshToken!.Token, newRefreshToken.ExpiresAt);

            return Ok(new
            {
                token = newAccessToken
            });
        }

        private void SetRefreshTokenCookie(string token, DateTime expiresAt)
        {
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = new DateTimeOffset(expiresAt)
            };

            Response.Cookies.Append("refreshToken", token, cookieOptions);
        }

        [HttpPost("log-out")]
        public async Task<IActionResult> Logout()
        {
            var refreshToken = Request.Cookies["refreshToken"];

            var (success, message) = await _authService.RevokeRefreshTokenAsync(refreshToken);

            if (!success)
                return Unauthorized(new { message });

            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax
            });

            return Ok(new { message });
        }
    }
}

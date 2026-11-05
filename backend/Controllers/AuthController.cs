
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


        [HttpPost("signup")]
        public async Task<IActionResult> SignUp([FromBody] SignUpDto dto)
        {    
            
           var result = await _authService.SignUpAsync(dto);

            if (!result.IsSuccess)
                return Conflict(new { message = result.Error }); 

            SetRefreshTokenCookie(result.Value!.AccessToken, result.Value.RefreshToken.ExpiresAt);

            return Ok(new
            {
                message = "Sign Up Successful",
                token = result.Value.AccessToken
            });

        }


        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LogInDto dto)
        {

            var result = await _authService.LoginAsync(dto);

            if (!result.IsSuccess)
                return Unauthorized(new { message = result.Error });

            SetRefreshTokenCookie(result.Value!.RefreshToken.Token, result.Value.RefreshToken.ExpiresAt);

            return Ok(new
            {
                message = "Log In Successful",
                token = result.Value.AccessToken
            });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh()
        {

            var refreshToken = Request.Cookies["refreshToken"];

            if (string.IsNullOrEmpty(refreshToken))
                return Unauthorized(new { message = "Refresh token is missing" });

            var result = await _authService.RefreshTokenAsync(refreshToken);

            SetRefreshTokenCookie(result.Value!.RefreshToken.Token, result.Value.RefreshToken.ExpiresAt);

            return Ok(new
            {
                token = result.Value.AccessToken
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

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var refreshToken = Request.Cookies["refreshToken"];

            var result = await _authService.RevokeRefreshTokenAsync(refreshToken);

            if (!result.IsSuccess)
                return Unauthorized(new { message = result.Error});

            Response.Cookies.Delete("refreshToken", new CookieOptions
            {
                HttpOnly = true,
                Secure = true,
                SameSite = SameSiteMode.Lax
            });

            return Ok(new { message = result.Error });
        }
    }
}
      
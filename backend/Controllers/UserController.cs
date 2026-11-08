using App.DTOs;
using App.IServices;
using App.Models;
using App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace App.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;

        public UserController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet("profile")]
        public async Task<IActionResult> GetUserProfile()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var id))
            {
                return Unauthorized();
            }

            var result = await _userService.GetUserProfileAsync(id);

            if (!result.IsSuccess)
                return NotFound();

            return Ok(result.Value);
        }

        [HttpGet("profile/{username}")]
        public async Task<IActionResult> GetUserProfileByUsername(string username)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var id))
            {
                return Unauthorized();
            }

            var result = await _userService.GetUserProfileByUsernameAsync(username);

            if (!result.IsSuccess)
                return NotFound();

            return Ok(result.Value);
        }


        [HttpGet("friend-requests")]
        public async Task<IActionResult> GetPendingFriendRequests()
        {
            var currentuserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var result = await _userService.GetPendingFriendRequestsAsync(currentuserId);

            if (!result.IsSuccess)
                return NotFound();

            return Ok(result.Value);
        }


        [HttpGet("friends")]
        public async Task<IActionResult> GetMyFriends()
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var result = await _userService.GetFriendsAsync(currentUserId);

            if (!result.IsSuccess)
                return NotFound();

            return Ok(result.Value);
        }

        [HttpPost("friends/request")]
        public async Task<IActionResult> SendFriendRequest([FromBody] SendRequestDto dto)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var result = await _userService.SendFriendRequestAsync(currentUserId, dto.FriendId);

            if (!result.IsSuccess)
            {
                return BadRequest(new { message = result.Error }); 
            }

            return Ok(new { message = "Запит успішно надіслано" });
        }

        [HttpPost("friends/{senderId}/accept")]
        public async Task<IActionResult> AcceptFriendRequest(int senderId)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var result = await _userService.AcceptFriendRequestAsync(currentUserId, senderId);

            if (!result.IsSuccess)
            {
                return NotFound(new { message = result.Error}); 
            }

            return Ok(new { message = "Запит прийнято" });
        }

        [HttpDelete("friends/reject/{senderId}")]
        public async Task<IActionResult> RejectFriendRequest(int senderId)
        {
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

            var result = await _userService.RejectFriendRequestAsync(currentUserId, senderId);

            if (!result.IsSuccess)
            {
                return NotFound(new { message = result.Error}); 
            }

            return Ok(new { message = "Запит у друзі успішно відхилено" });
        }

        [HttpDelete("friends/{friendId}")]
        public async Task<IActionResult> DeleteFriend(int friendId)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var currentUserId))
            {
                return Unauthorized(new { message = "Не вдалося визначити користувача." });
            }

            var result = await _userService.DeleteFriendAsync(currentUserId, friendId);

            if (!result.IsSuccess)
            {
                return NotFound(new { message = result.Error });
            }

            return Ok(new { message = "Друга успішно видалено" });
        }
    }
}
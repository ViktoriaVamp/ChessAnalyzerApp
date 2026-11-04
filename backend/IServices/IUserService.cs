using App.DTOs;
using App.Models;

namespace App.IServices
{
    public interface IUserService
    {
        Task<(bool success, User? user)> GetUserProfileAsync(int id);

        Task<(bool success, List<UserDto>? friends)> GetFriendsAsync(int currentUserId);

        Task<(bool success, string message)> SendFriendRequestAsync(int currentUserId, int friendId);
        Task<(bool success, string message)> AcceptFriendRequestAsync(int currentUserId, int senderId);
        Task<bool> RejectFriendRequestAsync(int currentUserId, int senderId);

    }
}

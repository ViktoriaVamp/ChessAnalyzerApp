using App.DTOs;
using App.Templates;

namespace App.IServices
{
    public interface IUserService
    {
        Task<Result<UserProfileDto>> GetUserProfileAsync(int id);
        Task<Result<UserProfileDto>> GetUserProfileByUsernameAsync(string username);
        Task<Result<List<UserDto>>> GetFriendsAsync(int currentUserId);
        Task<Result<bool>> SendFriendRequestAsync(int currentUserId, int friendId);
        Task<Result<bool>> AcceptFriendRequestAsync(int currentUserId, int senderId);
        Task<Result<bool>> RejectFriendRequestAsync(int currentUserId, int senderId);
        Task<Result<List<UserDto>>> GetPendingFriendRequestsAsync(int userId);
        Task<Result<bool>> DeleteFriendAsync(int currentUserId, int friendId);

    }
}

using App.Data;
using App.DTOs;
using App.IServices;
using App.Models;
using App.Templates;
using Microsoft.EntityFrameworkCore;

namespace App.Services
{
    public class UserService : IUserService
    {

        private readonly ApplicationDbContext _db;
        public UserService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<Result<UserProfileDto>> GetUserProfileAsync(int id)
        {
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return Result<UserProfileDto>.Failure("Користувача не знайдено.");
            }

            int friendsCount = await _db.Friendships
                .AsNoTracking()
                .CountAsync(f => (f.UserId == id || f.FriendId == id) && f.Status == FriendStatus.Accepted);

            var profileDto = new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                CreatedAt = user.CreatedAt,
                FriendsCount = friendsCount
            };

            return Result<UserProfileDto>.Success(profileDto);
        }


        public async Task<Result<List<UserDto>>> GetFriendsAsync(int currentUserId)
        {
            var friends = await _db.Friendships
                .AsNoTracking()
                .Where(f => (f.UserId == currentUserId || f.FriendId == currentUserId)
                            && f.Status == FriendStatus.Accepted)
                .Select(f => f.UserId == currentUserId
                    ? new UserDto { Id = f.Friend.Id, Username = f.Friend.Username }
                    : new UserDto { Id = f.User.Id, Username = f.User.Username })
                .ToListAsync();

            return Result<List<UserDto>>.Success(friends);
        }

        public async Task<Result<bool>> SendFriendRequestAsync(int currentUserId, int friendId)
        {
            if (currentUserId == friendId)
            {
                return Result<bool>.Failure("Неможливо надіслати запит самому собі.");
            }

            var targetExists = await _db.Users.AnyAsync(u => u.Id == friendId);
            if (!targetExists)
            {
                return Result<bool>.Failure("Цільового користувача не існує.");
            }

            var existing = await _db.Friendships
                .AnyAsync(f =>
                    (f.UserId == currentUserId && f.FriendId == friendId) ||
                    (f.UserId == friendId && f.FriendId == currentUserId));

            if (existing)
            {
                return Result<bool>.Failure("Запит або зв'язок між користувачами вже існує.");
            }

            var friendship = new Friendship
            {
                UserId = currentUserId,
                FriendId = friendId,
                Status = FriendStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            _db.Friendships.Add(friendship);
            await _db.SaveChangesAsync();

            return Result<bool>.Success(true);
        }


        public async Task<Result<bool>> AcceptFriendRequestAsync(int currentUserId, int senderId)
        {
            var friendship = await _db.Friendships
                .FirstOrDefaultAsync(f => f.UserId == senderId
                                       && f.FriendId == currentUserId
                                       && f.Status == FriendStatus.Pending);

            if (friendship == null)
            {
                return Result<bool>.Failure("Вхідний запит у друзі не знайдено.");
            }

            friendship.Status = FriendStatus.Accepted;
            await _db.SaveChangesAsync();

            return Result<bool>.Success(true);
        }


        public async Task<Result<bool>> RejectFriendRequestAsync(int currentUserId, int senderId)
        {
            var friendship = await _db.Friendships
                .FirstOrDefaultAsync(f => f.UserId == senderId
                                       && f.FriendId == currentUserId
                                       && f.Status == FriendStatus.Pending);

            if (friendship == null)
            {
                return Result<bool>.Failure("Вхідний запит у друзі не знайдено.");
            }

            _db.Friendships.Remove(friendship);
            await _db.SaveChangesAsync();

            return Result<bool>.Success(true);
        }
    }
}
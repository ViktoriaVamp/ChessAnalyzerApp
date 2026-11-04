using App.Data;
using App.IServices;
using App.Models;
using Microsoft.EntityFrameworkCore;
using App.DTOs;

namespace App.Services
{
    public class UserService : IUserService
    {

        private readonly ApplicationDbContext _db;
        public UserService(ApplicationDbContext db, IConfiguration configuration)
        {
            _db = db;
        }

        public async Task<(bool success, User? user)> GetUserProfileAsync(int id)
        {
            var user = await _db.Users.
                Include(u => u.SentFriendRequests)  
               .Include(u => u.ReceivedFriendRequests)
               .FirstOrDefaultAsync(u => u.Id == id);

            if (user == null)
            {
                return (false, null);
            }

            return (true, user);
        }

        public async Task<(bool success, List<UserDto>? friends)> GetFriendsAsync(int currentUserId)
        {
            var friendships = await _db.Friendships
                .Where(f => (f.UserId == currentUserId || f.FriendId == currentUserId)
                            && f.Status == FriendStatus.Accepted)
                .Include(f => f.User)  
                .Include(f => f.Friend)
                .ToListAsync();

            if (friendships == null || !friendships.Any())
            {
                return (true, new List<UserDto>()); 
            }

            var friendsList = friendships.Select(f =>
            {
                var friendEntity = f.UserId == currentUserId ? f.Friend : f.User;

                return new UserDto
                {
                    Id = friendEntity.Id,
                    Username = friendEntity.Username
                };
            }).ToList();

            return (true, friendsList);
        }

        public async Task<(bool success, string message)> SendFriendRequestAsync(int currentUserId, int friendId)
        {
            if (currentUserId == friendId)
            {
                return (false, "Неможливо надіслати запит самому собі.");
            }

            var existing = await _db.Friendships
                .FirstOrDefaultAsync(f =>
                    (f.UserId == currentUserId && f.FriendId == friendId) ||
                    (f.UserId == friendId && f.FriendId == currentUserId));

            if (existing != null)
            {
                return (false, "Запит або зв'язок між користувачами вже існує.");
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

            return (true, string.Empty);
        }

        public async Task<(bool success, string message)> AcceptFriendRequestAsync(int currentUserId, int senderId)
        {
            var friendship = await _db.Friendships
                .FirstOrDefaultAsync(f => f.UserId == senderId
                                       && f.FriendId == currentUserId
                                       && f.Status == FriendStatus.Pending);

            if (friendship == null)
            {
                return (false, "Вхідний запит у друзі не знайдено.");
            }

            friendship.Status = FriendStatus.Accepted;

            _db.Friendships.Update(friendship);
            await _db.SaveChangesAsync();

            return (true, string.Empty);
        }

        public async Task<bool> RejectFriendRequestAsync(int currentUserId, int senderId)
        {
            var friendship = await _db.Friendships
                .FirstOrDefaultAsync(f => f.UserId == senderId
                                       && f.FriendId == currentUserId
                                       && f.Status == FriendStatus.Pending);

            if (friendship == null)
            {
                return false;
            }

            _db.Friendships.Remove(friendship);
            await _db.SaveChangesAsync();

            return true;
        }


    }
}

using App.Data;
using App.DTOs;
using App.IServices;
using App.Models;
using App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace App.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class GameController : ControllerBase
    {
        private readonly IStockFishService _stockfishService;
        private readonly StockfishAnalysisService _analysisService;
        private readonly ApplicationDbContext _db;

        public GameController(IStockFishService stockfishService, StockfishAnalysisService analysisService, ApplicationDbContext db)
        {
            _stockfishService = stockfishService;
            _analysisService = analysisService;
            _db = db;
        }

        private async Task<int> ResolveUserIdAsync()
        {
            var claimId = User.FindFirstValue(ClaimTypes.NameIdentifier)
                       ?? User.FindFirstValue("id")
                       ?? User.FindFirstValue("sub");

            if (int.TryParse(claimId, out int parsedId))
            {
                bool exists = await _db.Users.AnyAsync(u => u.Id == parsedId);
                if (exists) return parsedId;
            }

            var claimName = User.Identity?.Name ?? User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email);
            if (!string.IsNullOrEmpty(claimName))
            {
                var userByName = await _db.Users.FirstOrDefaultAsync(u => u.Username == claimName || u.Email == claimName);
                if (userByName != null) return userByName.Id;
            }

            return await _db.Users.Select(u => u.Id).FirstOrDefaultAsync();
        }

        [HttpPost("bot-move")]
        public async Task<IActionResult> GetBotMove([FromBody] BotMoveRequestDto dto, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(dto.Fen))
            {
                return BadRequest(new { message = "Позиція FEN є обов'язковою." });
            }

            try
            {
                var bestMove = await _stockfishService.GetBestMoveAsync(dto.Fen, dto.BotElo, cancellationToken);

                if (string.IsNullOrEmpty(bestMove))
                {
                    return StatusCode(500, new { message = "Рушій не зміг знайти хід." });
                }

                return Ok(new
                {
                    from = bestMove.Substring(0, 2),
                    to = bestMove.Substring(2, 2),
                    promotion = bestMove.Length > 4 ? bestMove[4].ToString() : null
                });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { message = "Виконання задачі було скасовано." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Помилка сервера: {ex.Message}" });
            }
        }

        [HttpPost("analyze-start")]
        public async Task<IActionResult> StartAnalysis([FromBody] StartAnalysisRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Fen))
                return BadRequest(new { message = "Позиція FEN є обов'язковою." });

            if (dto.Depth < 1 || dto.Depth > 16 || dto.MaxMoves < 1 || dto.MaxMoves > 20)
            {
                return BadRequest(new
                {
                    message = "Перевищено максимальну трудомісткість задачі! Максимальна глибина: 16, максимум варіантів: 20."
                });
            }

            int validUserId = await ResolveUserIdAsync();

            bool hasRunningTask = await _db.AnalysisTasks.AnyAsync(t => t.UserId == validUserId && t.Status == "Running");
            if (hasRunningTask)
            {
                return BadRequest(new { message = "У вас вже виконується задача аналізу. Зачекайте або скасуйте її." });
            }

            int totalTasks = await _db.AnalysisTasks.CountAsync(t => t.UserId == validUserId);
            if (totalTasks >= 15)
            {
                var oldestTasks = await _db.AnalysisTasks
                    .Where(t => t.UserId == validUserId)
                    .OrderBy(t => t.CreatedAt)
                    .Take(totalTasks - 14)
                    .ToListAsync();
                _db.AnalysisTasks.RemoveRange(oldestTasks);
            }

            var task = new AnalysisTask
            {
                UserId = validUserId, // <-- Ось це поле було пропущене!
                Fen = dto.Fen,
                TargetDepth = dto.Depth,
                MaxMoves = dto.MaxMoves,
                Status = "Running",
                ProgressPercent = 0,
                Stage = "Постановка задачі в чергу...",
                CreatedAt = DateTime.UtcNow
            };

            _db.AnalysisTasks.Add(task);
            await _db.SaveChangesAsync();

            _analysisService.StartBackgroundAnalysis(task.Id, dto.Fen, dto.Depth, dto.MaxMoves);

            return Ok(new { taskId = task.Id });
        }

        [HttpGet("analyze-status/{taskId:guid}")]
        public async Task<IActionResult> GetAnalysisStatus(Guid taskId)
        {
            var task = await _db.AnalysisTasks.FindAsync(taskId);
            if (task == null) return NotFound(new { message = "Задачу не знайдено." });

            var moves = task.ResultMovesJson != null
                ? JsonSerializer.Deserialize<List<MoveHintDto>>(
                    task.ResultMovesJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                : null;

            return Ok(new
            {
                id = task.Id,
                status = task.Status,
                progress = task.ProgressPercent,
                stage = task.Stage,
                depth = task.TargetDepth,
                createdAt = task.CreatedAt,
                moves
            });
        }

        [HttpPost("analyze-cancel/{taskId:guid}")]
        public IActionResult CancelAnalysis(Guid taskId)
        {
            bool cancelled = _analysisService.CancelTask(taskId);
            if (!cancelled)
                return BadRequest(new { message = "Задачу вже завершено або не знайдено." });

            return Ok(new { message = "Запит на скасування відправлено." });
        }

        [HttpGet("analyze-history")]
        public async Task<IActionResult> GetAnalysisHistory()
        {
            int validUserId = await ResolveUserIdAsync();

            var tasks = await _db.AnalysisTasks
                .Where(t => t.UserId == validUserId)
                .OrderByDescending(t => t.CreatedAt)
                .Take(50)
                .Select(t => new
                {
                    id = t.Id,
                    fen = t.Fen,
                    depth = t.TargetDepth,
                    maxMoves = t.MaxMoves,
                    status = t.Status,
                    progress = t.ProgressPercent,
                    stage = t.Stage,
                    movesJson = t.ResultMovesJson,
                    createdAt = t.CreatedAt
                })
                .ToListAsync();

            return Ok(tasks);
        }

        [HttpPost("save-game")]
        public async Task<IActionResult> SaveGame([FromBody] SaveGameRequestDto dto)
        {
            int validUserId = await ResolveUserIdAsync();

            var savedGame = new SavedGame
            {
                UserId = validUserId, // <-- Прив'язуємо партію до реального користувача
                PlayerName = string.IsNullOrWhiteSpace(dto.PlayerName) ? "Гравець" : dto.PlayerName,
                BotName = string.IsNullOrWhiteSpace(dto.BotName) ? "Бот" : dto.BotName,
                BotElo = dto.BotElo,
                PlayerColor = dto.PlayerColor,
                ResultStatus = dto.ResultStatus,
                FenHistoryJson = JsonSerializer.Serialize(dto.FenHistory ?? new List<string>()),
                MovesSanJson = JsonSerializer.Serialize(dto.MovesSan ?? new List<string>()),
                CreatedAt = DateTime.UtcNow
            };

            _db.SavedGames.Add(savedGame);
            await _db.SaveChangesAsync();

            return Ok(new { id = savedGame.Id });
        }

        [HttpGet("games-history")]
        public async Task<IActionResult> GetGamesHistory()
        {
            int validUserId = await ResolveUserIdAsync();

            var games = await _db.SavedGames
                .Where(g => g.UserId == validUserId)
                .OrderByDescending(g => g.CreatedAt)
                .Take(30)
                .Select(g => new
                {
                    id = g.Id,
                    playerName = g.PlayerName,
                    botName = g.BotName,
                    botElo = g.BotElo,
                    playerColor = g.PlayerColor,
                    resultStatus = g.ResultStatus,
                    fenHistoryJson = g.FenHistoryJson,
                    movesSanJson = g.MovesSanJson,
                    createdAt = g.CreatedAt
                })
                .ToListAsync();

            return Ok(games);
        }
    }
}
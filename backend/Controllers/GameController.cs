using App.Data;
using App.DTOs;
using App.Models;
using App.Services;
using App.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

            bool hasRunningTask = await _db.AnalysisTasks.AnyAsync(t => t.Status == "Running");
            if (hasRunningTask)
            {
                return BadRequest(new { message = "У вас вже виконується задача аналізу. Зачекайте або скасуйте її." });
            }

            int totalTasks = await _db.AnalysisTasks.CountAsync();
            if (totalTasks >= 15)
            {
                var oldestTasks = await _db.AnalysisTasks
                    .OrderBy(t => t.CreatedAt)
                    .Take(totalTasks - 14)
                    .ToListAsync();
                _db.AnalysisTasks.RemoveRange(oldestTasks);
            }

            var task = new AnalysisTask
            {
                Fen = dto.Fen,
                TargetDepth = dto.Depth,
                MaxMoves = dto.MaxMoves,
                Status = "Running",
                ProgressPercent = 0,
                Stage = "Постановка задачі в чергу..."
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
            var history = await _db.AnalysisTasks
                .OrderByDescending(t => t.CreatedAt)
                .Take(10)
                .Select(t => new
                {
                    id = t.Id,
                    fen = t.Fen,
                    depth = t.TargetDepth,
                    status = t.Status,
                    progress = t.ProgressPercent,
                    stage = t.Stage,
                    createdAt = t.CreatedAt,
                    movesJson = t.ResultMovesJson
                })
                .ToListAsync();

            return Ok(history);
        }


    }
}
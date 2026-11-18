using App.Data;
using App.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace App.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly StockfishAnalysisService _analysisService;

        public AdminController(ApplicationDbContext db, StockfishAnalysisService analysisService)
        {
            _db = db;
            _analysisService = analysisService;
        }

        [HttpGet("monitoring")]
        public async Task<IActionResult> GetSystemMonitoring()
        {
            var currentServer = Environment.GetEnvironmentVariable("SERVER_NAME") ?? Environment.MachineName;
            var currentProcess = Process.GetCurrentProcess();

           
            var activeAndQueuedTasks = await _db.AnalysisTasks
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.Status == "Running" || t.Status == "Queued" || t.Status == "Pending")
                .OrderBy(t => t.CreatedAt)
                .Select(t => new
                {
                    id = t.Id,
                    userId = t.UserId,
                    username = t.User != null ? t.User.Username : $"User #{t.UserId}",
                    fen = t.Fen,
                    targetDepth = t.TargetDepth,
                    maxMoves = t.MaxMoves,
                    status = t.Status,
                    progressPercent = t.ProgressPercent,
                    stage = t.Stage,
                    serverName = t.ServerName ?? "Очікує в черзі",
                    createdAt = t.CreatedAt,
                    runningSeconds = (int)Math.Max(0, (DateTime.UtcNow - t.CreatedAt).TotalSeconds)
                })
                .ToListAsync();

          
            var recentHistory = await _db.AnalysisTasks
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.Status != "Running" && t.Status != "Queued" && t.Status != "Pending")
                .OrderByDescending(t => t.CreatedAt)
                .Take(15)
                .Select(t => new
                {
                    id = t.Id,
                    username = t.User != null ? t.User.Username : $"User #{t.UserId}",
                    targetDepth = t.TargetDepth,
                    maxMoves = t.MaxMoves,
                    status = t.Status,
                    progressPercent = t.ProgressPercent,
                    stage = t.Stage,
                    serverName = t.ServerName ?? "—",
                    createdAt = t.CreatedAt
                })
                .ToListAsync();

            int runningCount = activeAndQueuedTasks.Count(t => t.status == "Running");
            int queuedCount = activeAndQueuedTasks.Count(t => t.status == "Queued" || t.status == "Pending");
            int maxSlots = StockfishAnalysisService.MaxConcurrentSlots;

           
            int clusterLoadPercent = maxSlots > 0
                ? (int)Math.Min(100, Math.Round((double)runningCount / maxSlots * 100))
                : 0;

          
            var tasksPerServer = await _db.AnalysisTasks
                .AsNoTracking()
                .Where(t => t.ServerName != null)
                .GroupBy(t => t.ServerName!)
                .Select(g => new
                {
                    serverName = g.Key,
                    totalProcessed = g.Count(t => t.Status == "Completed"),
                    currentlyRunning = g.Count(t => t.Status == "Running")
                })
                .ToListAsync();

           
            double memoryMb = Math.Round(currentProcess.WorkingSet64 / (1024.0 * 1024.0), 1);
            int threadsCount = currentProcess.Threads.Count;
            var uptime = DateTime.UtcNow - currentProcess.StartTime.ToUniversalTime();

            return Ok(new
            {
                timestamp = DateTime.UtcNow,
                respondedByServer = currentServer,
                clusterMetrics = new
                {
                    runningTasksCount = runningCount,
                    queuedTasksCount = queuedCount,
                    maxClusterSlots = maxSlots,
                    clusterLoadPercent = clusterLoadPercent,
                    isOverloaded = queuedCount > 0 || runningCount >= maxSlots
                },
                nodeDiagnostics = new
                {
                    nodeName = currentServer,
                    memoryUsageMb = memoryMb,
                    activeThreads = threadsCount,
                    localStockfishProcesses = StockfishAnalysisService.GetLocalActiveProcessesCount(),
                    uptimeFormatted = $"{(int)uptime.TotalHours:D2}:{uptime.Minutes:D2}:{uptime.Seconds:D2}"
                },
                serverNodesSummary = tasksPerServer,
                activeTasks = activeAndQueuedTasks,
                recentTasks = recentHistory
            });
        }

       
        [HttpPost("kill-task/{taskId:guid}")]
        public async Task<IActionResult> KillTask(Guid taskId)
        {
            var task = await _db.AnalysisTasks.FindAsync(taskId);
            if (task == null)
                return NotFound(new { message = "Задачу не знайдено." });

            task.Status = "Cancelled";
            task.Stage = "Примусово зупинено адміністратором системи.";
            await _db.SaveChangesAsync();

            
            _analysisService.CancelTaskAsync(taskId);

            return Ok(new { message = $"Задачу {taskId} успішно зупинено адміністратором." });
        }

        [AllowAnonymous]
        [HttpGet("autoscale-status")]
        public async Task<IActionResult> GetAutoscaleStatus([FromQuery] int? activeContainers)
        {
            if (activeContainers.HasValue)
            {
                StockfishAnalysisService.CurrentClusterNodes = Math.Clamp(
                    activeContainers.Value,
                    StockfishAnalysisService.MinClusterNodes,
                    StockfishAnalysisService.MaxClusterNodes
                );
            }

            int running = await _db.AnalysisTasks.CountAsync(t => t.Status == "Running");
            int queued = await _db.AnalysisTasks.CountAsync(t => t.Status == "Queued" || t.Status == "Pending");

            return Ok(new
            {
                runningTasks = running,
                queuedTasks = queued,
                currentNodes = StockfishAnalysisService.CurrentClusterNodes,
                minNodes = StockfishAnalysisService.MinClusterNodes,
                maxNodes = StockfishAnalysisService.MaxClusterNodes
            });


        }
    }
}


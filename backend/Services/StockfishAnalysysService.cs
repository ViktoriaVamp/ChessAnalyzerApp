using App.Data;
using App.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;

namespace App.Services
{
    public class StockfishAnalysisService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly string _stockfishPath;
        private static readonly ConcurrentDictionary<Guid, CancellationTokenSource> ActiveTokens = new();

        private const int MaxClusterConcurrentTasks = 1;
        private const int EstimatedSecondsPerTask = 12;
        private static readonly SemaphoreSlim QueueCheckLock = new(1, 1);


        public static int GetLocalActiveProcessesCount() => ActiveTokens.Count;
        public static int MaxConcurrentSlots => MaxClusterConcurrentTasks;


        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public StockfishAnalysisService(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;

          
            _stockfishPath = Environment.GetEnvironmentVariable("STOCKFISH_PATH")
                 ?? Path.Combine(AppContext.BaseDirectory, "StockFish", "stockfish-windows-x86-64-universal.exe");  
           
        }

        public async Task<bool> CancelTaskAsync(Guid taskId)
        {
            bool cancelledLocally = false;
            if (ActiveTokens.TryRemove(taskId, out var cts))
            {
                cts.Cancel();
                cts.Dispose();
                cancelledLocally = true;
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var task = await db.AnalysisTasks.FindAsync(taskId);
            if (task == null)
                return false;

            if (task.Status == "Running")
            {
                task.Status = "Cancelled";
                task.Stage = "Виконання скасовано користувачем.";
                await db.SaveChangesAsync();
                return true;
            }

            return cancelledLocally;
        }


        public void StartBackgroundAnalysis(Guid taskId, string fen, int targetDepth, int maxMoves)
        {
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));
            ActiveTokens[taskId] = cts;

            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                Process? process = null;

                try
                {
                    while (true)
                    {
                        cts.Token.ThrowIfCancellationRequested();

                        bool canStart = false;
                        int queuePosition = 1;
                        int estimatedWaitSeconds = EstimatedSecondsPerTask;
                        await QueueCheckLock.WaitAsync(cts.Token);
                        try
                        {
                            var currentTask = await db.AnalysisTasks.FindAsync(taskId);
                            if (currentTask == null) return;

                            await db.Entry(currentTask).ReloadAsync(cts.Token);
                            if (currentTask.Status == "Cancelled")
                            {
                                throw new OperationCanceledException();
                            }

                            var runningTasks = await db.AnalysisTasks
                                .AsNoTracking()
                                .Where(t => t.Status == "Running" && t.Id != taskId)
                                .ToListAsync(cts.Token);

                            var tasksAheadInQueue = await db.AnalysisTasks
                                .AsNoTracking()
                                .Where(t => (t.Status == "Queued" || t.Status == "Pending")
                                            && t.CreatedAt < currentTask.CreatedAt
                                            && t.Id != taskId)
                                .ToListAsync(cts.Token);

                            int runningCount = runningTasks.Count;
                            int aheadInQueue = tasksAheadInQueue.Count;

                            if (runningCount < MaxClusterConcurrentTasks && aheadInQueue == 0)
                            {
                                currentTask.Status = "Running";
                                currentTask.ServerName = Environment.GetEnvironmentVariable("SERVER_NAME") ?? Environment.MachineName; 
                                currentTask.ProgressPercent = 5;
                                currentTask.Stage = "Ресурси виділено. Запуск процесу Stockfish...";
                                await db.SaveChangesAsync(cts.Token);
                                canStart = true;
                            }
                            else
                            {
                              
                                double totalRemainingSeconds = 0;

                                foreach (var rt in runningTasks)
                                {
                                    double fullTaskSeconds = Math.Max(6.0, rt.TargetDepth * 0.65); 
                                    double remainingFraction = Math.Clamp((100.0 - rt.ProgressPercent) / 100.0, 0.05, 1.0);
                                    totalRemainingSeconds += fullTaskSeconds * remainingFraction;
                                }

                                foreach (var qt in tasksAheadInQueue)
                                {
                                    double fullTaskSeconds = Math.Max(6.0, qt.TargetDepth * 0.65);
                                    totalRemainingSeconds += fullTaskSeconds;
                                }

                                estimatedWaitSeconds = Math.Max(1, (int)Math.Ceiling(totalRemainingSeconds / MaxClusterConcurrentTasks));
                                queuePosition = aheadInQueue + 1;

                                currentTask.Status = "Queued";
                                currentTask.ProgressPercent = 0;
                                currentTask.Stage = $"Всі ресурси зайняті. Ви у черзі (позиція #{queuePosition}). Орієнтовний час очікування: ~{estimatedWaitSeconds} с...";
                                await db.SaveChangesAsync(cts.Token);
                            }
                        }
                        finally
                        {
                            QueueCheckLock.Release();
                        }
                        if (canStart) break;

                       
                        await Task.Delay(1000, cts.Token);
                    }

                
                    if (!File.Exists(_stockfishPath))
                    {
                        throw new FileNotFoundException($"Не знайдено файл рушія за шляхом: {_stockfishPath}");
                    }

                    var startInfo = new ProcessStartInfo
                    {
                        FileName = _stockfishPath,
                        RedirectStandardInput = true,
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    process = Process.Start(startInfo)
                        ?? throw new InvalidOperationException("Не вдалося запустити процес Stockfish.");

                    using var writer = process.StandardInput;
                    writer.AutoFlush = true;
                    using var reader = process.StandardOutput;

                    await writer.WriteLineAsync("uci");
                    await writer.WriteLineAsync($"setoption name MultiPV value {maxMoves}");
                    await writer.WriteLineAsync("isready");

                    while (!reader.EndOfStream)
                    {
                        var line = await reader.ReadLineAsync(cts.Token);
                        if (line == "readyok") break;
                    }

                    await UpdateProgressAsync(db, taskId, 15, "Передача позиції та початок розрахунку...");
                    await writer.WriteLineAsync($"position fen {fen}");
                    await writer.WriteLineAsync($"go depth {targetDepth}");

                    var movesByPv = new Dictionary<int, (string Move, double Score, int? Mate, string[] Line)>();
                    int lastReportedDepth = 0;
                    var lastDbUpdateTime = DateTime.UtcNow;

                    while (!reader.EndOfStream)
                    {
                        var line = await reader.ReadLineAsync(cts.Token);
                        if (string.IsNullOrEmpty(line)) continue;

                        if (line.StartsWith("info depth"))
                        {
                            ParseInfoLine(line, movesByPv, out int currentDepth);

                            if (currentDepth > lastReportedDepth && currentDepth <= targetDepth)
                            {
                                lastReportedDepth = currentDepth;
                                int percent = 15 + (int)Math.Round((double)currentDepth / targetDepth * 75);

                               
                                if ((DateTime.UtcNow - lastDbUpdateTime).TotalMilliseconds >= 200 || currentDepth == targetDepth)
                                {
                                    await UpdateProgressAsync(
                                        db,
                                        taskId,
                                        percent,
                                        $"Аналіз дерева ходів: глибина {currentDepth} із {targetDepth}..."
                                    );
                                    lastDbUpdateTime = DateTime.UtcNow;
                                }
                                await Task.Delay(250, cts.Token);
                            }
                        }
                        else if (line.StartsWith("bestmove"))
                        {
                            break;
                        }
                    }

                    await UpdateProgressAsync(db, taskId, 95, "Формування оцінок та пояснень ходів...");

                    var resultHints = BuildMoveExplanations(movesByPv);
                    var taskEntity = await db.AnalysisTasks.FindAsync(taskId);
                    if (taskEntity != null)
                    {
                        await db.Entry(taskEntity).ReloadAsync(cts.Token);
                        if (taskEntity.Status == "Cancelled")
                        {
                            throw new OperationCanceledException();
                        }

                        taskEntity.Status = "Completed";
                        taskEntity.ProgressPercent = 100;
                        taskEntity.Stage = "Аналіз успішно завершено";
                        taskEntity.ResultMovesJson = JsonSerializer.Serialize(resultHints, JsonOptions);
                        await db.SaveChangesAsync(cts.Token);
                    }
                }
                catch (OperationCanceledException)
                {
                    var taskEntity = await db.AnalysisTasks.FindAsync(taskId);
                    if (taskEntity != null)
                    {
                        taskEntity.Status = "Cancelled";
                        taskEntity.Stage = "Виконання задачі було скасовано.";
                        await db.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    var taskEntity = await db.AnalysisTasks.FindAsync(taskId);
                    if (taskEntity != null)
                    {
                        taskEntity.Status = "Failed";
                        taskEntity.Stage = $"Помилка: {ex.Message}";
                        await db.SaveChangesAsync();
                    }
                }
                finally
                {
                    if (process is { HasExited: false })
                    {
                        try { process.Kill(true); } catch { }
                    }
                    process?.Dispose();
                    ActiveTokens.TryRemove(taskId, out _);
                    cts.Dispose();
                }
            });
        }
        private static async Task UpdateProgressAsync(ApplicationDbContext db, Guid taskId, int percent, string stage)
        {
            var task = await db.AnalysisTasks.FindAsync(taskId);
            if (task != null)
           {  
               await db.Entry(task).ReloadAsync();

                if (task.Status == "Cancelled")
                {
                    throw new OperationCanceledException();
                }

                task.ProgressPercent = percent;
                task.Stage = stage;
                await db.SaveChangesAsync();
            }
        }

        private static void ParseInfoLine(
            string line,
            Dictionary<int, (string Move, double Score, int? Mate, string[] Line)> movesByPv,
            out int depth)
        {
            depth = 0;
            var tokens = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            int depthIdx = Array.IndexOf(tokens, "depth");
            if (depthIdx != -1 && depthIdx + 1 < tokens.Length)
                int.TryParse(tokens[depthIdx + 1], out depth);

            int multipv = 1;
            int mpvIdx = Array.IndexOf(tokens, "multipv");
            if (mpvIdx != -1 && mpvIdx + 1 < tokens.Length)
                int.TryParse(tokens[mpvIdx + 1], out multipv);

            double scorePawns = 0;
            int? mate = null;
            int scoreIdx = Array.IndexOf(tokens, "score");
            if (scoreIdx != -1 && scoreIdx + 2 < tokens.Length)
            {
                if (tokens[scoreIdx + 1] == "cp" && int.TryParse(tokens[scoreIdx + 2], out int cp))
                    scorePawns = Math.Round(cp / 100.0, 2);
                else if (tokens[scoreIdx + 1] == "mate" && int.TryParse(tokens[scoreIdx + 2], out int m))
                {
                    mate = m;
                    scorePawns = m > 0 ? 99.0 : -99.0;
                }
            }

            int pvIdx = Array.IndexOf(tokens, "pv");
            if (pvIdx != -1 && pvIdx + 1 < tokens.Length)
            {
                var pvLine = tokens[(pvIdx + 1)..];
                var firstMove = pvLine[0];
                movesByPv[multipv] = (firstMove, scorePawns, mate, pvLine);
            }
        }

        private static List<MoveHintDto> BuildMoveExplanations(
            Dictionary<int, (string Move, double Score, int? Mate, string[] Line)> movesByPv)
        {
            var result = new List<MoveHintDto>();
            if (movesByPv.Count == 0) return result;

            var ordered = movesByPv.OrderBy(kv => kv.Key).Select(kv => kv.Value).ToList();
            double bestScore = ordered[0].Score;

            foreach (var item in ordered)
            {
                string from = item.Move.Substring(0, 2);
                string to = item.Move.Substring(2, 2);
                string? promo = item.Move.Length > 4 ? item.Move[4].ToString() : null;

                double diff = bestScore - item.Score;

                string quality = diff switch
                {
                    <= 0.15 => "Найкращий хід",
                    <= 0.50 => "Хороший хід",
                    <= 1.20 => "Неточність",
                    <= 2.50 => "Помилка",
                    _ => "Груба помилка (Зівок)"
                };

                string? replyMove = item.Line.Length > 1
                    ? $"{item.Line[1][..2].ToUpper()}➔{item.Line[1].Substring(2, 2).ToUpper()}"
                    : null;
                string? followUpMove = item.Line.Length > 2
                    ? $"{item.Line[2][..2].ToUpper()}➔{item.Line[2].Substring(2, 2).ToUpper()}"
                    : null;

                string explanation;
                if (item.Mate.HasValue)
                {
                    explanation = item.Mate.Value > 0
                        ? $"Форсований мат супернику за {item.Mate.Value} хід(ів)!"
                        : $"Фатально: дозволяє супернику поставити вам мат за {Math.Abs(item.Mate.Value)} хід(ів).";
                }
                else if (quality == "Найкращий хід" || quality == "Хороший хід")
                {
                    explanation = $"Оцінка позиції: {(item.Score >= 0 ? "+" : "")}{item.Score}. " +
                                  (replyMove != null
                                      ? $"Зберігає сильний контроль. Очікувана відповідь бота: {replyMove}" +
                                        (followUpMove != null ? $", на що ви відповідаєте {followUpMove}." : ".")
                                      : "Покращує активність фігур.");
                }
                else
                {
                    explanation = $"Втрата {Math.Round(diff, 2)} пішака відносно найкращого ходу (оцінка {(item.Score >= 0 ? "+" : "")}{item.Score}). " +
                                  (replyMove != null
                                      ? $"Суперник скористається цим через сильний контрхід {replyMove}."
                                      : "Погіршує захищеність ваших фігур.");
                }

                result.Add(new MoveHintDto(from, to, promo, item.Score, quality, explanation));
            }

            return result;
        }
    }
}
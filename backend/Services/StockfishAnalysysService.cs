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

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public StockfishAnalysisService(IServiceScopeFactory scopeFactory, IWebHostEnvironment env)
        {
            _scopeFactory = scopeFactory;

          
            _stockfishPath = Path.Combine(
                env.ContentRootPath,
                "StockFish",
                "stockfish-windows-x86-64-universal.exe"
            );
        }

        public bool CancelTask(Guid taskId)
        {
            if (ActiveTokens.TryRemove(taskId, out var cts))
            {
                cts.Cancel();
                cts.Dispose();
                return true;
            }
            return false;
        }

        public void StartBackgroundAnalysis(Guid taskId, string fen, int targetDepth, int maxMoves)
        {
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25)); 
            ActiveTokens[taskId] = cts;

            _ = Task.Run(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                Process? process = null;

                try
                {
                    await UpdateProgressAsync(db, taskId, 5, "Запуск процесу Stockfish...");

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
                        cts.Token.ThrowIfCancellationRequested();
                        if (await reader.ReadLineAsync() == "readyok") break;
                    }

                    await UpdateProgressAsync(db, taskId, 15, "Передача позиції та початок розрахунку...");
                    await writer.WriteLineAsync($"position fen {fen}");
                    await writer.WriteLineAsync($"go depth {targetDepth}");

                    var movesByPv = new Dictionary<int, (string Move, double Score, int? Mate, string[] Line)>();
                    int lastReportedDepth = 0;

                    while (!reader.EndOfStream)
                    {
                        cts.Token.ThrowIfCancellationRequested();

                        var line = await reader.ReadLineAsync();
                        if (string.IsNullOrEmpty(line)) continue;

                        if (line.StartsWith("info depth"))
                        {
                            ParseInfoLine(line, movesByPv, out int currentDepth);

                            // Оновлюємо прогрес у БД при переході на нову глибину (Вимога 2)
                            if (currentDepth > lastReportedDepth && currentDepth <= targetDepth)
                            {
                                lastReportedDepth = currentDepth;
                                int percent = 15 + (int)Math.Round((double)currentDepth / targetDepth * 75);
                                await UpdateProgressAsync(
                                    db,
                                    taskId,
                                    percent,
                                    $"Аналіз дерева ходів: глибина {currentDepth} із {targetDepth}..."
                                );

                                // Невелика затримка, щоб прогрес плавно оновлювався на UI і задачу можна було скасувати
                                await Task.Delay(250, cts.Token);
                            }
                        }
                        else if (line.StartsWith("bestmove"))
                        {
                            break;
                        }
                    }

                    await UpdateProgressAsync(db, taskId, 95, "Формування оцінок та пояснень ходів...");
                    await Task.Delay(200, cts.Token);

                    var resultHints = BuildMoveExplanations(movesByPv);
                    var taskEntity = await db.AnalysisTasks.FindAsync(taskId);
                    if (taskEntity != null)
                    {
                        taskEntity.Status = "Completed";
                        taskEntity.ProgressPercent = 100;
                        taskEntity.Stage = "Аналіз успішно завершено";
                        taskEntity.ResultMovesJson = JsonSerializer.Serialize(resultHints, JsonOptions);
                        await db.SaveChangesAsync();
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
                        try { process.Kill(); } catch { }
                    }
                    process?.Dispose();
                    ActiveTokens.TryRemove(taskId, out _);
                }
            });
        }

        private static async Task UpdateProgressAsync(ApplicationDbContext db, Guid taskId, int percent, string stage)
        {
            var task = await db.AnalysisTasks.FindAsync(taskId);
            if (task != null)
            {
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
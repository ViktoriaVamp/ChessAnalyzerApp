
using App.IServices;
using System.Diagnostics;


namespace App.Services
{
    public class StockfishService : IStockFishService
    {
        private readonly string _stockfishPath;

        public StockfishService()
        {
            _stockfishPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "Stockfish",
                "stockfish-windows-x86-64-universal.exe"
            );
        }

        public async Task<string> GetBestMoveAsync(string fen, int elo, CancellationToken cancellationToken)
        {
           
            var (skillLevel, moveTimeMs) = elo switch
            {
                <= 400 => (0, Random.Shared.Next(500, 2000)),   
                <= 800 => (3, Random.Shared.Next(1500, 3000)),   
                <= 1200 => (7, Random.Shared.Next(2500,4500 )),  
                <= 1600 => (13, Random.Shared.Next(4000, 6000)),
                _ => (20, Random.Shared.Next(5000, 9000)) 
            };

            var startInfo = new ProcessStartInfo
            {
                FileName = _stockfishPath,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(startInfo);
            if (process == null)
                throw new InvalidOperationException("Не вдалося запустити процес Stockfish.");

            using var writer = process.StandardInput;
            using var reader = process.StandardOutput;

            
            await writer.WriteLineAsync("uci");

            await writer.WriteLineAsync($"setoption name Skill Level value {skillLevel}");
            if (elo >= 1320)
            {
                await writer.WriteLineAsync("setoption name UCI_LimitStrength value true");
                await writer.WriteLineAsync($"setoption name UCI_Elo value {elo}");
            }

            await writer.WriteLineAsync("isready");
            while (!reader.EndOfStream)
            {
                var line = await reader.ReadLineAsync();
                if (line == "readyok") break;
            }

            await writer.WriteLineAsync($"position fen {fen}");
            await writer.WriteLineAsync($"go movetime {moveTimeMs}");

            string bestMove = string.Empty;

            while (!reader.EndOfStream)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var line = await reader.ReadLineAsync();
                if (line != null && line.StartsWith("bestmove"))
                {
                    var parts = line.Split(' ');
                    bestMove = parts[1]; 
                    break;
                }
            }

            if (!process.HasExited)
            {
                process.Kill();
            }

            return bestMove;
        }
    }
 }

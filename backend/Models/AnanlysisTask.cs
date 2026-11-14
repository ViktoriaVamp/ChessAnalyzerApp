using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace App.Models
{
    public class AnalysisTask
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int UserId { get; set; }
        public User? User { get; set; }

        public string Fen { get; set; } = string.Empty;
        public int TargetDepth { get; set; }
        public int MaxMoves { get; set; }

        public string Status { get; set; } = "Running";
        public int ProgressPercent { get; set; } = 0;
        public string Stage { get; set; } = "Ініціалізація задачі...";

        public string? ResultMovesJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class SavedGame
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int UserId { get; set; }
        public User? User { get; set; }

        public string PlayerName { get; set; } = "Гравець";
        public string BotName { get; set; } = "Бот";
        public int BotElo { get; set; }
        public string PlayerColor { get; set; } = "white";
        public string ResultStatus { get; set; } = string.Empty;
        public string FenHistoryJson { get; set; } = "[]";
        public string MovesSanJson { get; set; } = "[]";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public record SaveGameRequestDto(
        int? UserId,
        string PlayerName,
        string BotName,
        int BotElo,
        string PlayerColor,
        string ResultStatus,
        List<string> FenHistory,
        List<string> MovesSan
    );

    public record MoveHintDto(
        string From,
        string To,
        string? Promotion,
        double ScorePawns,
        string Quality,
        string Explanation
    );

    public record StartAnalysisRequestDto(
        string Fen,
        int Depth = 12,
        int MaxMoves = 10,
        int? UserId = null
    );
}
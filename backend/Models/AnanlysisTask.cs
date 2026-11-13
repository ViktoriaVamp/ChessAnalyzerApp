namespace App.Models
{
    public class AnalysisTask
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Fen { get; set; } = string.Empty;
        public int TargetDepth { get; set; }
        public int MaxMoves { get; set; }

        public string Status { get; set; } = "Running"; 
        public int ProgressPercent { get; set; } = 0;
        public string Stage { get; set; } = "Ініціалізація задачі...";

     
        public string? ResultMovesJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public record MoveHintDto(
        string From,
        string To,
        string? Promotion,
        double ScorePawns,
        string Quality,   
        string Explanation  
    );

    public record StartAnalysisRequestDto(string Fen, int Depth = 12, int MaxMoves = 10);
}

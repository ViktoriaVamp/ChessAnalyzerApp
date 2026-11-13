namespace App.IServices
{
    public interface IStockFishService
    {
        Task<string> GetBestMoveAsync(string fen, int elo, CancellationToken cancellationToken);

    }
}

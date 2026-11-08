using App.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using App.DTOs;


namespace App.Controllers
{
   

    [Authorize]
    [ApiController]
    [Route("api/[controller]")] 
    public class GameController : ControllerBase
    {
        private readonly StockfishService _stockfishService;

        public GameController(StockfishService stockfishService)
        {
            _stockfishService = stockfishService;
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
    }

   
}

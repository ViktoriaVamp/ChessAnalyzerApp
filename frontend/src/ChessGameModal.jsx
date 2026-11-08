import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import styles from "./ChessGameModal.module.css";
import api from "./api";

const ChessGameModal = ({ bot, user, onClose }) => {
 
  const [playerColor] = useState(() => (Math.random() < 0.5 ? "white" : "black"));
  const botColor = playerColor === "white" ? "black" : "white";


  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [gameStatus, setGameStatus] = useState("Партія триває");
  const [isGameOver, setIsGameOver] = useState(false);
  const [hint, setHint] = useState(null);

 
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});

  const [playerTime, setPlayerTime] = useState(600);
  const [botTime, setBotTime] = useState(600);
  const timerRef = useRef(null);

  
  const currentTurn = gameRef.current.turn() === "w" ? "white" : "black";
  const isBotTurn = currentTurn === botColor && !isGameOver;
  const isPlayerTurn = currentTurn === playerColor && !isGameOver;


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const clearHighlights = useCallback(() => {
    setMoveFrom(null);
    setOptionSquares({});
  }, []);

  useEffect(() => {
    clearHighlights();
  }, [fen, clearHighlights]);

  const handleGameOver = useCallback((statusText) => {
    setIsGameOver(true);
    setGameStatus(statusText);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);


  const checkGameState = useCallback(
    (chessInstance) => {
      if (chessInstance.isCheckmate()) {
        const winner = chessInstance.turn() === "w" ? "Чорні" : "Білі";
        handleGameOver(`Мат! Перемогли ${winner}!`);
        return true;
      } else if (chessInstance.isDraw()) {
        handleGameOver("Партія завершилась внічию.");
        return true;
      }
      return false;
    },
    [handleGameOver]
  );

  const showMoveOptions = (square) => {
    const game = gameRef.current;
    const moves = game.moves({
      square,
      verbose: true,
    });

    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares = {};

    moves.forEach((move) => {
      const targetPiece = game.get(move.to);
      const sourcePiece = game.get(square);
      const isCapture = targetPiece && sourcePiece && targetPiece.color !== sourcePiece.color;

      newSquares[move.to] = {
        background: isCapture
          ? "radial-gradient(circle, transparent 60%, rgba(255, 255, 255, 0.45) 62%, rgba(255, 255, 255, 0.45) 82%, transparent 85%)"
          : "radial-gradient(circle, rgba(250, 250, 250 , 0.60) 12%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.3)",
    };

    setOptionSquares(newSquares);
    return true;
  };

  useEffect(() => {
    if (isGameOver) return;

    timerRef.current = setInterval(() => {
      if (currentTurn === playerColor) {
        setPlayerTime((prev) => Math.max(0, prev - 1));
      } else {
        setBotTime((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentTurn, isGameOver, playerColor]);

  useEffect(() => {
    if (isGameOver) return;
    if (playerTime === 0) {
      handleGameOver("Час вичерпано. Бот переміг!");
    } else if (botTime === 0) {
      handleGameOver("Час бота вичерпано. Ви перемогли!");
    }
  }, [playerTime, botTime, isGameOver, handleGameOver]);

  
  const makeBotMove = useCallback(async () => {
  const game = gameRef.current;
  if (isGameOver || (game.turn() === "w" ? "white" : "black") !== botColor) return;

  try {
    const response = await api.post('/api/game/bot-move', {
      fen: game.fen(),        
      botElo: bot?.elo || 400   
    });

    const { from, to, promotion } = response.data;

    game.move({
      from,
      to,
      promotion: promotion || "q",
    });

    setFen(game.fen());
    setHint(null);
    checkGameState(game);
  } catch (e) {
    console.error("Помилка ходу бота:", e.response?.data || e);
  }
}, [botColor, isGameOver, checkGameState, bot]);

  useEffect(() => {
    if (isBotTurn) {
      const timeout = setTimeout(() => {
        makeBotMove();
      }, 700);

      return () => clearTimeout(timeout);
    }
  }, [isBotTurn, fen, makeBotMove]);

  const handleSquareClick = (arg1) => {
    if (isGameOver || !isPlayerTurn) return;

 
    const square = typeof arg1 === "object" && arg1 !== null ? arg1.square : arg1;
    if (!square) return;

    const game = gameRef.current;
    const playerColorCode = playerColor === "white" ? "w" : "b";

    
    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }

    
    if (moveFrom) {
      try {
        const move = game.move({
          from: moveFrom,
          to: square,
          promotion: "q",
        });

        if (move !== null) {
          setFen(game.fen());
          setHint(null);
          setMoveFrom(null);
          setOptionSquares({});
          checkGameState(game);
          return;
        }
      } catch (e) {
     
      }
    }

   
    const clickedPiece = game.get(square);
    if (clickedPiece && clickedPiece.color === playerColorCode) {
      setMoveFrom(square);
      showMoveOptions(square);
    } else {
      setMoveFrom(null);
      setOptionSquares({});
    }
  };

  
  const handlePieceDragBegin = (arg1, arg2) => {
    if (isGameOver || !isPlayerTurn) return;
    const sourceSquare = typeof arg1 === "object" && arg1 !== null ? arg1.square : arg2;
    if (!sourceSquare) return;

    const piece = gameRef.current.get(sourceSquare);
    const playerColorCode = playerColor === "white" ? "w" : "b";

    if (piece && piece.color === playerColorCode) {
      setMoveFrom(sourceSquare);
      showMoveOptions(sourceSquare);
    }
  };
  const handlePieceDrop = (arg1, arg2) => {
    const game = gameRef.current;
    const turnColor = game.turn() === "w" ? "white" : "black";

    if (isGameOver || turnColor !== playerColor) return false;

    const sourceSquare = typeof arg1 === "object" && arg1 !== null ? arg1.sourceSquare : arg1;
    const targetSquare = typeof arg1 === "object" && arg1 !== null ? arg1.targetSquare : arg2;

    if (!sourceSquare || !targetSquare || sourceSquare === targetSquare) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) return false;

      setFen(game.fen());
      setHint(null);
      checkGameState(game);
      return true;
    } catch (error) {
      return false;
    }
  };

  const canDragPiece = (arg) => {
    if (!isPlayerTurn) return false;
    // У v4 arg.piece — це рядок типу "wP", у v5 arg.piece.pieceType — "wP"
    const pieceStr = typeof arg?.piece === "string" ? arg.piece : arg?.piece?.pieceType || "";
    if (!pieceStr) return true;
    const pieceColor = pieceStr.startsWith("w") ? "white" : "black";
    return pieceColor === playerColor;
  };

  const handleResign = () => {
    if (isGameOver) return;
    handleGameOver("Ви здалися. Перемога бота.");
  };

  const handleHint = () => {
    if (!isPlayerTurn) return;
    const moves = gameRef.current.moves({ verbose: true });
    if (moves.length > 0) {
      const recommended = moves[Math.floor(Math.random() * moves.length)];
      setHint(`${recommended.from.toUpperCase()} ➔ ${recommended.to.toUpperCase()}`);
    }
  };

  // Спільні налаштування для сумісності з react-chessboard v4 та v5+
  const boardConfig = {
    position: fen,
    onPieceDrop: handlePieceDrop,
    onSquareClick: handleSquareClick,
    onPieceDragBegin: handlePieceDragBegin,
    onPieceDrag: handlePieceDragBegin,
    boardOrientation: playerColor,
    isDraggablePiece: canDragPiece,
    canDragPiece: canDragPiece,
    customSquareStyles: optionSquares,
    squareStyles: optionSquares,
    customDarkSquareStyle: { backgroundColor: "#560000" },
    customLightSquareStyle: { backgroundColor: "#666" },
    darkSquareStyle: { backgroundColor: "#560000" },
    lightSquareStyle: { backgroundColor: "#666" },
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Хедер модального вікна */}
        <div className={styles.header}>
          <h2 className={styles.title}>{bot?.name || "Бот"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Картка суперника (Бота) */}
          <div className={`${styles.playerCard} ${isBotTurn ? styles.activeTurnCard : ""}`}>
            <div className={styles.playerInfo}>
              <div className={styles.avatar}>B</div>
              <div>
                <span className={styles.playerName}>{bot?.name || "Бот"}</span>
                <span className={styles.roleSubtext}>
                  Колір: {botColor === "white" ? "Білі" : "Чорні"}
                </span>
              </div>
            </div>
            <div className={`${styles.timer} ${isBotTurn ? styles.activeTimer : ""}`}>
              {formatTime(botTime)}
            </div>
          </div>

          {/* Шахова дошка */}
          <div className={styles.boardWrapper}>
            <Chessboard {...boardConfig} options={boardConfig} />
          </div>

          {/* Картка гравця (Ви) */}
          <div className={`${styles.playerCard} ${isPlayerTurn ? styles.activeTurnCard : ""}`}>
            <div className={styles.playerInfo}>
              <div className={styles.avatar}>
                {(user?.username || user?.nickname || "U")[0].toUpperCase()}
              </div>
              <div>
                <span className={styles.playerName}>
                  {user?.username || user?.nickname || "Ви"}
                </span>
                <span className={styles.roleSubtext}>
                  Колір: {playerColor === "white" ? "Білі" : "Чорні"}
                </span>
              </div>
            </div>
            <div className={`${styles.timer} ${isPlayerTurn ? styles.activeTimer : ""}`}>
              {formatTime(playerTime)}
            </div>
          </div>

          {/* Повідомлення про підказку або завершення */}
          {hint && (
            <div className={styles.hintBox}>
              Рекомендований хід: <strong>{hint}</strong>
            </div>
          )}
          {isGameOver && (
            <div className={styles.gameOverBanner}>{gameStatus}</div>
          )}

          {/* Панель дій */}
          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.hintBtn}`}
              onClick={handleHint}
              disabled={!isPlayerTurn}
            >
              Підказка
            </button>
            <button
              className={`${styles.btn} ${styles.resignBtn}`}
              onClick={handleResign}
              disabled={isGameOver}
            >
              Здатись
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChessGameModal;
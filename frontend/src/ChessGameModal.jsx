import React, { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import styles from "./ChessGameModal.module.css";
import api from "./api";

const MAX_ALLOWED_DEPTH = 16;
const MAX_ALLOWED_MOVES = 20;

const ChessGameModal = ({ bot, user, onClose }) => {
  const [playerColor] = useState(() => (Math.random() < 0.5 ? "white" : "black"));
  const botColor = playerColor === "white" ? "black" : "white";

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [gameStatus, setGameStatus] = useState("Партія триває");
  const [isGameOver, setIsGameOver] = useState(false);

  const fenHistoryRef = useRef([gameRef.current.fen()]);
  const moveHistoryRef = useRef([]);
  const isSavedRef = useRef(false);

  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});

  const [analysisDepth, setAnalysisDepth] = useState(12);
  const [multiPv, setMultiPv] = useState(6);

  const [validationError, setValidationError] = useState("");
  const [currentTask, setCurrentTask] = useState(null);
  const [selectedHintMove, setSelectedHintMove] = useState(null);
  const [taskHistory, setTaskHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const pollingRef = useRef(null);

  const [playerTime, setPlayerTime] = useState(600);
  const [botTime, setBotTime] = useState(600);
  const timerRef = useRef(null);

  const currentTurn = gameRef.current.turn() === "w" ? "white" : "black";
  const isBotTurn = currentTurn === botColor && !isGameOver;
  const isPlayerTurn = currentTurn === playerColor && !isGameOver;

  const saveGameToDb = useCallback(
    async (statusText) => {
      if (isSavedRef.current || moveHistoryRef.current.length === 0) return;
      isSavedRef.current = true;
      try {
        await api.post("/api/game/save-game", {
          userId: user?.id,
          playerName: user?.username || user?.nickname || "Ви",
          botName: bot?.name || "Бот",
          botElo: bot?.elo || 400,
          playerColor: playerColor,
          resultStatus: statusText,
          fenHistory: fenHistoryRef.current,
          movesSan: moveHistoryRef.current,
        });
      } catch (e) {
        console.error("Помилка збереження партії:", e);
      }
    },
    [user, bot, playerColor]
  );

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const clearHighlights = useCallback(() => {
    setMoveFrom(null);
    setOptionSquares({});
    setSelectedHintMove(null);
  }, []);

  useEffect(() => {
    clearHighlights();
  }, [fen, clearHighlights]);

  // Завантаження історії задач із БД (Вимога 3)
  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get("/api/game/analyze-history", {
        params: { userId: user?.id },
      });
      setTaskHistory(res.data || []);
    } catch (e) {
      console.error("Помилка завантаження історії задач:", e);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchHistory();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchHistory]);

  const handleGameOver = useCallback(
    (statusText) => {
      setIsGameOver(true);
      setGameStatus(statusText);
      clearHighlights();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);

      saveGameToDb(statusText);
    },
    [clearHighlights, saveGameToDb]
  );

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
    const moves = game.moves({ square, verbose: true });

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
          ? "radial-gradient(circle, transparent 68%, rgba(255, 255, 255, 0.45) 71%, rgba(255, 255, 255, 0.45) 81%, transparent 84%)"
          : "radial-gradient(circle, rgba(255, 255, 255, 0.45) 12%, transparent 15%)",
        borderRadius: "50%",
      };
    });

    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.25)",
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
      const response = await api.post("/api/game/bot-move", {
        fen: game.fen(),
        botElo: bot?.elo || 400,
      });

      const { from, to, promotion } = response.data;

      const move = game.move({
        from,
        to,
        promotion: promotion || "q",
      });

      if (move) {
        fenHistoryRef.current.push(game.fen());
        moveHistoryRef.current.push(move.san);
        clearHighlights();
        setFen(game.fen());
        checkGameState(game);
      }
    } catch (e) {
      console.error("Помилка ходу бота:", e.response?.data || e);
    }
  }, [botColor, isGameOver, checkGameState, bot, clearHighlights]);

  useEffect(() => {
    if (isBotTurn) {
      const timeout = setTimeout(() => {
        makeBotMove();
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [isBotTurn, fen, makeBotMove]);

  // Запуск аналізу позиції (Вимоги 1, 2, 3)
  const handleStartAnalysis = async () => {
    if (!isPlayerTurn) return;
    setValidationError("");
    setSelectedHintMove(null);

    const legalMovesCount = gameRef.current.moves().length;

    // ВИМОГА 1: Перевірка глибини (складності обчислення) на клієнті
    if (analysisDepth < 1 || analysisDepth > MAX_ALLOWED_DEPTH) {
      setValidationError(
        `Помилка: глибина (${analysisDepth}) має бути в межах від 1 до ${MAX_ALLOWED_DEPTH}!`
      );
      return;
    }

    // ВИМОГА 1: Перевірка MultiPV (кількості невідомих варіантів) на клієнті
    if (multiPv < 1 || multiPv > MAX_ALLOWED_MOVES) {
      setValidationError(
        `Помилка: MultiPV (${multiPv}) перевищує ліміт варіантів (дозволено від 1 до ${MAX_ALLOWED_MOVES})!`
      );
      return;
    }

    if (legalMovesCount === 0) {
      setValidationError("Немає доступних ходів для аналізу.");
      return;
    }

    try {
      const res = await api.post("/api/game/analyze-start", {
        userId: user?.id,
        fen: gameRef.current.fen(),
        depth: Number(analysisDepth),
        maxMoves: Number(multiPv),
      });

      const { taskId } = res.data;
      setCurrentTask({
        id: taskId,
        status: "Running",
        progress: 0,
        stage: "Ініціалізація задачі...",
        moves: [],
      });

      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/game/analyze-status/${taskId}`);
          const data = statusRes.data;
          setCurrentTask(data);

          if (data.status !== "Running") {
            clearInterval(pollingRef.current);
            fetchHistory();
          }
        } catch (err) {
          clearInterval(pollingRef.current);
        }
      }, 300);
    } catch (e) {
      setValidationError(e.response?.data?.message || "Не вдалося запустити аналіз позиції.");
    }
  };

  // Скасування виконання поточної задачі (Вимога 3)
  const handleCancelAnalysis = async () => {
    if (!currentTask || currentTask.status !== "Running") return;
    try {
      await api.post(`/api/game/analyze-cancel/${currentTask.id}`);
    } catch (e) {
      console.error("Помилка скасування:", e);
    }
  };

  const handleSquareClick = (arg1) => {
    const game = gameRef.current;
    const liveTurnColor = game.turn() === "w" ? "white" : "black";

    if (isGameOver || liveTurnColor !== playerColor) {
      clearHighlights();
      return;
    }

    const square = typeof arg1 === "object" && arg1 !== null ? arg1.square : arg1;
    if (!square) return;

    const playerColorCode = playerColor === "white" ? "w" : "b";

    if (moveFrom === square) {
      clearHighlights();
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
          fenHistoryRef.current.push(game.fen());
          moveHistoryRef.current.push(move.san);
          clearHighlights();
          setFen(game.fen());
          checkGameState(game);
          return;
        }
      } catch (e) {}
    }

    const clickedPiece = game.get(square);
    if (clickedPiece && clickedPiece.color === playerColorCode) {
      setSelectedHintMove(null);
      setMoveFrom(square);
      showMoveOptions(square);
    } else {
      clearHighlights();
    }
  };

  const handlePieceDragBegin = (arg1, arg2) => {
    const game = gameRef.current;
    const liveTurnColor = game.turn() === "w" ? "white" : "black";
    if (isGameOver || liveTurnColor !== playerColor) return;

    const sourceSquare = typeof arg1 === "object" && arg1 !== null ? arg1.square : arg2;
    if (!sourceSquare) return;

    const piece = game.get(sourceSquare);
    const playerColorCode = playerColor === "white" ? "w" : "b";

    if (piece && piece.color === playerColorCode) {
      setSelectedHintMove(null);
      setMoveFrom(sourceSquare);
      showMoveOptions(sourceSquare);
    }
  };

  const handlePieceDrop = (arg1, arg2) => {
    const game = gameRef.current;
    const turnColor = game.turn() === "w" ? "white" : "black";

    if (isGameOver || turnColor !== playerColor) {
      clearHighlights();
      return false;
    }

    const sourceSquare = typeof arg1 === "object" && arg1 !== null ? arg1.sourceSquare : arg1;
    const targetSquare = typeof arg1 === "object" && arg1 !== null ? arg1.targetSquare : arg2;

    if (!sourceSquare || !targetSquare || sourceSquare === targetSquare) {
      clearHighlights();
      return false;
    }

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) {
        clearHighlights();
        return false;
      }

      fenHistoryRef.current.push(game.fen());
      moveHistoryRef.current.push(move.san);
      clearHighlights();
      setFen(game.fen());
      checkGameState(game);
      return true;
    } catch (error) {
      clearHighlights();
      return false;
    }
  };

  const canDragPiece = (arg) => {
    if (!isPlayerTurn) return false;
    const pieceStr = typeof arg?.piece === "string" ? arg.piece : arg?.piece?.pieceType || "";
    if (!pieceStr) return true;
    const pieceColor = pieceStr.startsWith("w") ? "white" : "black";
    return pieceColor === playerColor;
  };

  const handleResign = () => {
    if (isGameOver) return;
    handleGameOver("Ви здалися. Перемога бота.");
  };

  // Формуємо стилі підсвічування: або крапочки ходів, або вибраний хід зі списку підказок
  const combinedSquareStyles = {};
  if (isPlayerTurn) {
    Object.assign(combinedSquareStyles, optionSquares);

    if (selectedHintMove) {
      let bgColor;
      let borderColor;

      switch (selectedHintMove.quality) {
        case "Найкращий хід":
        case "Хороший хід":
          bgColor = "rgba(34, 197, 94, 0.55)"; // Зелений
          borderColor = "#4ade80";
          break;

        case "Неточність":
          bgColor = "rgba(250, 204, 21, 0.55)"; // Жовтий
          borderColor = "#facc15";
          break;

        default: // "Помилка" та "Груба помилка (Зівок)"
          bgColor = "rgba(239, 68, 68, 0.55)"; // Червоний
          borderColor = "#f87171";
          break;
      }

      combinedSquareStyles[selectedHintMove.from] = {
        backgroundColor: "rgba(59, 130, 246, 0.55)",
        boxShadow: "inset 0 0 0 3px #60a5fa",
      };

      combinedSquareStyles[selectedHintMove.to] = {
        backgroundColor: bgColor,
        boxShadow: `inset 0 0 0 3px ${borderColor}`,
      };
    }
  }

  const boardConfig = {
    position: fen,
    onPieceDrop: handlePieceDrop,
    onSquareClick: handleSquareClick,
    onPieceDragBegin: handlePieceDragBegin,
    boardOrientation: playerColor,
    isDraggablePiece: canDragPiece,
    canDragPiece: canDragPiece,
    customSquareStyles: combinedSquareStyles,
    squareStyles: combinedSquareStyles,
    customDarkSquareStyle: { backgroundColor: "#460000" },
    customLightSquareStyle: { backgroundColor: "#555555" },
    darkSquareStyle: { backgroundColor: "#460000" },
    lightSquareStyle: { backgroundColor: "#555555" },
  };

  return (
    <div
      className={styles.overlay}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 1000,
      }}
    >
      <div
        className={styles.modal}
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "92vh",
          backgroundColor: "#141417",
          border: "1px solid #451a1a",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* Фіксована шапка */}
        <div className={styles.header} style={{ flexShrink: 0 }}>
          <h2 className={styles.title}>{bot?.name || "Бот"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Контент із внутрішнім скролом */}
        <div
          className={styles.content}
          style={{
            display: "block",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "12px 16px 20px",
          }}
        >
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
          <div
            className={styles.boardWrapper}
            style={{
              width: "100%",
              maxWidth: "350px",
              aspectRatio: "1 / 1",
              flexShrink: 0,
              overflow: "visible",
              margin: "12px auto",
            }}
          >
            <Chessboard {...boardConfig} options={boardConfig} />
          </div>

          {/* Картка гравця */}
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

          {/* Налаштування глибини та MultiPV */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px",
              marginTop: "10px",
              fontSize: "13px",
              color: "#ddd",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label>Глибина (1–{MAX_ALLOWED_DEPTH}):</label>
              <input
                type="number"
                value={analysisDepth}
                onChange={(e) => setAnalysisDepth(Number(e.target.value))}
                style={{
                  width: "52px",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  background: "#222",
                  color: "#fff",
                  border: "1px solid #555",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label>MultiPV (1–{MAX_ALLOWED_MOVES}):</label>
              <input
                type="number"
                value={multiPv}
                onChange={(e) => setMultiPv(Number(e.target.value))}
                style={{
                  width: "52px",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  background: "#222",
                  color: "#fff",
                  border: "1px solid #555",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowHistory((prev) => !prev)}
              style={{
                marginLeft: "auto",
                background: "#27272a",
                color: "#fff",
                border: "1px solid #52525b",
                borderRadius: "4px",
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {showHistory ? "Сховати історію" : `Історія задач (${taskHistory.length})`}
            </button>
          </div>

          {validationError && (
            <div
              style={{
                background: "#5c1313",
                color: "#fca5a5",
                padding: "8px",
                borderRadius: "6px",
                fontSize: "13px",
                marginTop: "8px",
              }}
            >
              {validationError}
            </div>
          )}

          {/* Прогрес та стан поточної задачі */}
          {currentTask && (
            <div
              style={{
                background: "#1f2937",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "8px",
                border: "1px solid #374151",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  color: "#e5e7eb",
                  marginBottom: "6px",
                }}
              >
                <span>{currentTask.stage}</span>
                <strong>{currentTask.progress}%</strong>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "#374151",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${currentTask.progress}%`,
                    height: "100%",
                    background:
                      currentTask.status === "Failed"
                        ? "#ef4444"
                        : currentTask.status === "Cancelled"
                        ? "#f59e0b"
                        : currentTask.status === "Completed"
                        ? "#22c55e"
                        : "#3b82f6",
                    transition: "width 0.25s ease",
                  }}
                />
              </div>

              {currentTask.status === "Running" && (
                <button
                  onClick={handleCancelAnalysis}
                  style={{
                    marginTop: "8px",
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "5px 10px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Скасувати виконання задачі
                </button>
              )}
            </div>
          )}

          {/* Список проаналізованих ходів */}
          {currentTask && currentTask.status === "Completed" && currentTask.moves?.length > 0 && (
            <div
              style={{
                maxHeight: "175px",
                overflowY: "auto",
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "8px",
                padding: "8px",
                marginTop: "8px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "6px" }}>
                Натисніть на хід у списку, щоб підсвітити фігуру та поле на шахівниці:
              </div>
              {currentTask.moves.map((m, idx) => {
                const fromSq = m.from || m.From;
                const toSq = m.to || m.To;
                const quality = m.quality || m.Quality;
                const explanation = m.explanation || m.Explanation;
                const isSelected =
                  selectedHintMove?.from === fromSq && selectedHintMove?.to === toSq;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setMoveFrom(null);
                      setOptionSquares({});
                      setSelectedHintMove({ from: fromSq, to: toSq, quality });
                    }}
                    style={{
                      padding: "7px 10px",
                      marginBottom: "5px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: isSelected ? "#27272a" : "#111113",
                      border: isSelected ? "1px solid #60a5fa" : "1px solid #27272a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        fontWeight: "bold",
                        color: "#fff",
                      }}
                    >
                      <span>
                        {fromSq?.toUpperCase()} ➔ {toSq?.toUpperCase()}
                      </span>
                      <span
                        style={{
                          color:
                            quality === "Найкращий хід" || quality === "Хороший хід"
                              ? "#4ade80"
                              : quality === "Неточність"
                              ? "#facc15"
                              : "#f87171",
                        }}
                      >
                        {quality}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#d4d4d8", marginTop: "3px" }}>
                      {explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Історія результатів виконання задач із БД */}
          {showHistory && (
            <div
              style={{
                maxHeight: "140px",
                overflowY: "auto",
                background: "#18181b",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "8px",
                marginTop: "8px",
                fontSize: "12px",
              }}
            >
              <strong style={{ color: "#e4e4e7", display: "block", marginBottom: "6px" }}>
                Історія задач аналізу (збережено в БД):
              </strong>
              {taskHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setCurrentTask({
                      id: item.id,
                      status: item.status,
                      progress: item.progress,
                      stage: item.stage,
                      moves: item.movesJson ? JSON.parse(item.movesJson) : [],
                    });
                  }}
                  style={{
                    padding: "5px",
                    borderBottom: "1px solid #27272a",
                    cursor: "pointer",
                    color: "#d4d4d8",
                  }}
                >
                  Глибина: {item.depth} | Статус: <strong>{item.status}</strong> ({item.progress}%)
                  — {new Date(item.createdAt).toLocaleTimeString()}
                </div>
              ))}
            </div>
          )}

          {isGameOver && <div className={styles.gameOverBanner}>{gameStatus}</div>}

          {/* Панель дій */}
          <div className={styles.actions} style={{ marginTop: "10px" }}>
            <button
              className={`${styles.btn} ${styles.hintBtn}`}
              onClick={handleStartAnalysis}
              disabled={!isPlayerTurn || currentTask?.status === "Running"}
            >
              {currentTask?.status === "Running" ? "Аналізуємо..." : "Аналіз ходів (Підказка)"}
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
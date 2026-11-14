import React, { useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import api from "./api";
import "./SavedGamesPage.module.css";

const SavedGamesPage = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState("games"); // "games" | "analyses"
  const [games, setGames] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Вибрана партія та поточний крок (індекс FEN)
  const [selectedGame, setSelectedGame] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Вибраний запит аналізу та вибраний хід-підказка для підсвічування
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [selectedHintMove, setSelectedHintMove] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [gamesRes, analysesRes] = await Promise.all([
          api.get("/api/game/games-history", { params: { userId: user?.id } }),
          api.get("/api/game/analyze-history", { params: { userId: user?.id } }),
        ]);

        const loadedGames = (gamesRes.data || []).map((g) => ({
          ...g,
          fens: g.fenHistoryJson ? JSON.parse(g.fenHistoryJson) : [],
          moves: g.movesSanJson ? JSON.parse(g.movesSanJson) : [],
        }));

        const loadedAnalyses = (analysesRes.data || []).map((a) => ({
          ...a,
          moves: a.movesJson ? JSON.parse(a.movesJson) : [],
        }));

        setGames(loadedGames);
        setAnalyses(loadedAnalyses);

        if (loadedGames.length > 0) {
          setSelectedGame(loadedGames[0]);
          setCurrentStep(Math.max(0, loadedGames[0].fens.length - 1));
        }
      } catch (err) {
        console.error("Помилка завантаження архіву:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  // Визначаємо, яку позицію (FEN) та орієнтацію показувати на дошці
  let displayedFen = "start";
  let boardOrientation = "white";

  if (activeTab === "games" && selectedGame) {
    displayedFen = selectedGame.fens[currentStep] || "start";
    boardOrientation = selectedGame.playerColor || "white";
  } else if (activeTab === "analyses" && selectedAnalysis) {
    displayedFen = selectedAnalysis.fen || "start";
  }

  // Підсвічування клітинок для режиму перегляду запитів аналізу
  const customSquareStyles = {};
  if (activeTab === "analyses" && selectedHintMove) {
    let bgColor = "rgba(239, 68, 68, 0.55)";
    let borderColor = "#f87171";

    if (
      selectedHintMove.quality === "Найкращий хід" ||
      selectedHintMove.quality === "Хороший хід"
    ) {
      bgColor = "rgba(34, 197, 94, 0.55)";
      borderColor = "#4ade80";
    } else if (selectedHintMove.quality === "Неточність") {
      bgColor = "rgba(250, 204, 21, 0.55)";
      borderColor = "#facc15";
    }

    customSquareStyles[selectedHintMove.from] = {
      backgroundColor: "rgba(59, 130, 246, 0.55)",
      boxShadow: "inset 0 0 0 3px #60a5fa",
    };
    customSquareStyles[selectedHintMove.to] = {
      backgroundColor: bgColor,
      boxShadow: `inset 0 0 0 3px ${borderColor}`,
    };
  }

  const boardConfig = {
    position: displayedFen,
    boardOrientation: boardOrientation,
    arePiecesDraggable: false,
    isDraggablePiece: () => false,
    customSquareStyles: customSquareStyles,
    squareStyles: customSquareStyles,
    customDarkSquareStyle: { backgroundColor: "#460000" },
    customLightSquareStyle: { backgroundColor: "#555555" },
    darkSquareStyle: { backgroundColor: "#460000" },
    lightSquareStyle: { backgroundColor: "#555555" },
  };

  const getAnalysisStatusClass = (status) => {
    if (status === "Completed") return "status-green";
    if (status === "Cancelled") return "status-yellow";
    return "status-red";
  };

  const getMoveQualityClass = (quality) => {
    if (quality === "Найкращий хід" || quality === "Хороший хід") return "status-green";
    if (quality === "Неточність") return "status-yellow";
    return "status-red";
  };

  return (
    <div className="saved-games-container">
      {/* Шапка сторінки з кнопкою повернення назад до вибору ботів */}
      <div className="saved-games-header">
        <div className="header-left">
          <button onClick={onBack} className="back-btn">
            ← Назад до ботів
          </button>
          <h2 className="header-title">Архів партій та аналізів</h2>
        </div>

        {/* Перемикач вкладок */}
        <div className="tabs-switcher">
          <button
            onClick={() => {
              setActiveTab("games");
              setSelectedHintMove(null);
            }}
            className={`tab-btn ${activeTab === "games" ? "active" : ""}`}
          >
            📁 Збережені партії ({games.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("analyses");
              if (!selectedAnalysis && analyses.length > 0) {
                setSelectedAnalysis(analyses[0]);
              }
            }}
            className={`tab-btn ${activeTab === "analyses" ? "active" : ""}`}
          >
            🔍 Історія аналізів ({analyses.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-message">Завантаження історії...</div>
      ) : (
        <div className="saved-games-grid">
          {/* ЛІВА КОЛОНКА: Список партій або Список запитів аналізу */}
          <div className="list-column">
            {activeTab === "games" ? (
              games.length === 0 ? (
                <div className="empty-message">
                  У вас ще немає збережених партій. Зіграйте партію з ботом!
                </div>
              ) : (
                games.map((g) => {
                  const isSelected = selectedGame?.id === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => {
                        setSelectedGame(g);
                        setCurrentStep(Math.max(0, g.fens.length - 1));
                      }}
                      className={`history-card ${isSelected ? "selected" : ""}`}
                    >
                      <div className="game-card-header">
                        <span>
                          {g.playerName} vs {g.botName} (Ело ~{g.botElo})
                        </span>
                        <span className="game-card-date">
                          {new Date(g.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="game-card-result">{g.resultStatus}</div>
                      <div className="game-card-meta">
                        Колір: {g.playerColor === "white" ? "Білі" : "Чорні"} • Ходів:{" "}
                        {g.moves.length} • {new Date(g.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })
              )
            ) : analyses.length === 0 ? (
              <div className="empty-message">
                Ви ще не запускали аналіз позицій.
              </div>
            ) : (
              analyses.map((a) => {
                const isSelected = selectedAnalysis?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => {
                      setSelectedAnalysis(a);
                      setSelectedHintMove(null);
                    }}
                    className={`history-card ${isSelected ? "selected" : ""}`}
                  >
                    <div className="analysis-card-header">
                      <span>Глибина аналізу: {a.depth}</span>
                      <span className={getAnalysisStatusClass(a.status)}>
                        {a.status} ({a.progress}%)
                      </span>
                    </div>
                    <div className="analysis-card-meta">
                      Знайдено варіантів: {a.moves?.length || 0} •{" "}
                      {new Date(a.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ПРАВА КОЛОНКА: Шахова дошка + Плеєр ходів або Підказки аналізу */}
          <div className="board-column">
            <div className="board-wrapper">
              <Chessboard {...boardConfig} options={boardConfig} />
            </div>

            {/* Керування для вкладки "Збережені партії" */}
            {activeTab === "games" && selectedGame && (
              <div className="controls-wrapper">
                <div className="step-controls">
                  <button
                    onClick={() => setCurrentStep(0)}
                    disabled={currentStep === 0}
                    className="step-btn"
                  >
                    ⏮
                  </button>
                  <button
                    onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    disabled={currentStep === 0}
                    className="step-btn"
                  >
                    ◀ Назад
                  </button>
                  <span className="step-counter">
                    Хід {currentStep} / {Math.max(0, selectedGame.fens.length - 1)}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentStep((s) => Math.min(selectedGame.fens.length - 1, s + 1))
                    }
                    disabled={currentStep >= selectedGame.fens.length - 1}
                    className="step-btn"
                  >
                    Вперед ▶
                  </button>
                  <button
                    onClick={() => setCurrentStep(selectedGame.fens.length - 1)}
                    disabled={currentStep >= selectedGame.fens.length - 1}
                    className="step-btn"
                  >
                    ⏭
                  </button>
                </div>

                {/* Список усіх ходів партії */}
                <div className="moves-list">
                  {selectedGame.moves.map((san, idx) => {
                    const stepIdx = idx + 1;
                    const active = currentStep === stepIdx;
                    const moveNum = idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}. ` : "";
                    return (
                      <span
                        key={idx}
                        onClick={() => setCurrentStep(stepIdx)}
                        className={`move-chip ${active ? "active" : ""}`}
                      >
                        {moveNum}
                        {san}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Деталі для вкладки "Історія аналізів" */}
            {activeTab === "analyses" && selectedAnalysis && (
              <div className="controls-wrapper">
                <div className="analysis-hint-label">
                  Натисніть на варіант ходу нижче, щоб підсвітити його на дошці:
                </div>
                <div className="analysis-moves-list">
                  {(selectedAnalysis.moves || []).map((m, idx) => {
                    const fromSq = m.from || m.From;
                    const toSq = m.to || m.To;
                    const quality = m.quality || m.Quality;
                    const explanation = m.explanation || m.Explanation;
                    const isSelected =
                      selectedHintMove?.from === fromSq && selectedHintMove?.to === toSq;

                    return (
                      <div
                        key={idx}
                        onClick={() =>
                          setSelectedHintMove({ from: fromSq, to: toSq, quality })
                        }
                        className={`hint-card ${isSelected ? "selected" : ""}`}
                      >
                        <div className="hint-card-header">
                          <span>
                            {fromSq?.toUpperCase()} ➔ {toSq?.toUpperCase()}
                          </span>
                          <span className={getMoveQualityClass(quality)}>
                            {quality}
                          </span>
                        </div>
                        <div className="hint-card-explanation">{explanation}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedGamesPage;
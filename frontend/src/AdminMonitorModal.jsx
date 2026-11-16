import React, { useState, useEffect, useCallback } from "react";
import styles from "./AdminMonitorModal.module.css";
import api from "./api";

const AdminMonitorModal = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [nodesMap, setNodesMap] = useState({});
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const res = await api.get("/api/admin/monitoring");
      const payload = res.data;
      setData(payload);
      setError("");

      if (payload?.nodeDiagnostics?.nodeName) {
        setNodesMap((prev) => ({
          ...prev,
          [payload.nodeDiagnostics.nodeName]: {
            ...payload.nodeDiagnostics,
            lastSeen: new Date().toLocaleTimeString(),
          },
        }));
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Не вдалося отримати дані моніторингу (перевірте права Admin)."
      );
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
    if (!autoRefresh) return;

    const interval = setInterval(fetchMonitoringData, 1200);
    return () => clearInterval(interval);
  }, [fetchMonitoringData, autoRefresh]);

  const handleKillTask = async (taskId) => {
    try {
      await api.post(`/api/admin/kill-task/${taskId}`);
      fetchMonitoringData();
    } catch (err) {
      alert("Помилка при зупинці задачі.");
    }
  };

  const cluster = data?.clusterMetrics || {
    runningTasksCount: 0,
    queuedTasksCount: 0,
    maxClusterSlots: 2,
    clusterLoadPercent: 0,
    isOverloaded: false,
  };

  const allNodes = Object.values(nodesMap);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Шапка модального вікна */}
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <span className={styles.shieldIcon}>🛡️</span>
            <div>
              <h2 className={styles.title}>Панель адміністратора: Моніторинг кластера</h2>
              <p className={styles.subtitle}>
                Балансувальник Nginx (least_conn) • Останній пакет від:{" "}
                <strong className={styles.highlightServer}>
                  {data?.respondedByServer || "..."}
                </strong>
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              className={`${styles.toggleBtn} ${autoRefresh ? styles.activeLive : ""}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "● LIVE (1.2s)" : "⏸ Пауза"}
            </button>
            <button className={styles.closeBtn} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Блок 1: Загальне навантаження на систему */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Завантаження слотів CPU</span>
            <div className={styles.metricValueRow}>
              <span className={styles.metricBigValue}>
                {cluster.runningTasksCount} / {cluster.maxClusterSlots}
              </span>
              <span
                className={`${styles.statusBadge} ${
                  cluster.isOverloaded ? styles.badgeDanger : styles.badgeOk
                }`}
              >
                {cluster.clusterLoadPercent}%
              </span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={`${styles.progressBarFill} ${
                  cluster.isOverloaded ? styles.fillDanger : ""
                }`}
                style={{ width: `${cluster.clusterLoadPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Задач у черзі (FIFO)</span>
            <div className={styles.metricValueRow}>
              <span className={styles.metricBigValue}>{cluster.queuedTasksCount}</span>
              <span className={styles.metricUnit}>очікують ресурсів</span>
            </div>
            <p className={styles.metricHint}>
              {cluster.queuedTasksCount > 0
                ? "⚠️ Всі обчислювальні слоти зайняті!"
                : "✓ Ресурси доступні без черги"}
            </p>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Активні вузли Docker</span>
            <div className={styles.metricValueRow}>
              <span className={styles.metricBigValue}>{allNodes.length}</span>
              <span className={styles.metricUnit}>сервери онлайн</span>
            </div>
            <p className={styles.metricHint}>PostgreSQL (Neon) синхронізовано</p>
          </div>
        </div>

        {/* Блок 2: Стан кожного сервера (AppServer-1 та AppServer-2) */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Вузли серверів застосувань (Docker Containers)</h3>
          <div className={styles.nodesGrid}>
            {allNodes.map((node) => {
              const summary = data?.serverNodesSummary?.find(
                (s) => s.serverName === node.nodeName
              );
              return (
                <div key={node.nodeName} className={styles.nodeCard}>
                  <div className={styles.nodeHeader}>
                    <span className={styles.nodeName}>🖥️ {node.nodeName}</span>
                    <span className={styles.nodeOnline}>● Online ({node.lastSeen})</span>
                  </div>
                  <div className={styles.nodeStats}>
                    <div>
                      <span>RAM (Working Set):</span>
                      <strong>{node.memoryUsageMb} MB</strong>
                    </div>
                    <div>
                      <span>Активні потоки (.NET):</span>
                      <strong>{node.activeThreads}</strong>
                    </div>
                    <div>
                      <span>Процеси Stockfish тут:</span>
                      <strong>{node.localStockfishProcesses}</strong>
                    </div>
                    <div>
                      <span>Uptime контейнера:</span>
                      <strong>{node.uptimeFormatted}</strong>
                    </div>
                    <div>
                      <span>Всього виконано задач:</span>
                      <strong>{summary?.totalProcessed || 0}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Блок 3: Активні процеси та черга в реальному часі */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Запущені процеси та черга ({data?.activeTasks?.length || 0})
          </h3>

          {!data?.activeTasks?.length ? (
            <div className={styles.emptyBox}>
              Наразі немає запущених обчислень або задач у черзі. Система вільна.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Користувач</th>
                    <th>Параметри</th>
                    <th>Сервер (Вузол)</th>
                    <th>Статус</th>
                    <th>Прогрес та поточний етап</th>
                    <th>Час</th>
                    <th>Дія</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activeTasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.username}</strong>
                      </td>
                      <td>
                        Depth: <b>{task.targetDepth}</b> | MultiPV: <b>{task.maxMoves}</b>
                      </td>
                      <td>
                        <span className={styles.serverTag}>{task.serverName}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.taskStatus} ${
                            task.status === "Running"
                              ? styles.statusRunning
                              : styles.statusQueued
                          }`}
                        >
                          {task.status === "Running" ? "⚙️ Виконується" : "⏳ У черзі"}
                        </span>
                      </td>
                      <td className={styles.progressCell}>
                        <div className={styles.miniProgressWrap}>
                          <div
                            className={styles.miniProgressBar}
                            style={{ width: `${task.progressPercent}%` }}
                          />
                        </div>
                        <div className={styles.stageText}>
                          <b>{task.progressPercent}%</b> — {task.stage}
                        </div>
                      </td>
                      <td>{task.runningSeconds} с</td>
                      <td>
                        <button
                          className={styles.killBtn}
                          onClick={() => handleKillTask(task.id)}
                          title="Примусово завершити процес"
                        >
                          Зупинити
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Блок 4: Історія останніх задач */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Останні завершені / скасовані задачі кластера</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Користувач</th>
                  <th>Складність</th>
                  <th>Виконав сервер</th>
                  <th>Статус</th>
                  <th>Результат / Причина</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentTasks?.map((t) => (
                  <tr key={t.id}>
                    <td>{t.username}</td>
                    <td>
                      D:{t.targetDepth} / PV:{t.maxMoves}
                    </td>
                    <td>
                      <span className={styles.serverTag}>{t.serverName}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.taskStatus} ${
                          t.status === "Completed"
                            ? styles.statusCompleted
                            : styles.statusCancelled
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className={styles.stageText}>{t.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMonitorModal;
# Налаштування лімітів горизонтального масштабування
$MIN_CONTAINERS = 2
$MAX_CONTAINERS = 4  
$API_URL = "https://localhost/api/admin/autoscale-status"

add-type @"
    using System.Net;
    using System.Security.Cryptography.X509Certificates;
    public class TrustAllCertsPolicy : ICertificatePolicy {
        public bool CheckValidationResult(
            ServicePoint srvPoint, X509Certificate certificate,
            WebRequest request, int certificateProblem) {
            return true;
        }
    }
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  DOCKER AUTO-SCALER ЗАПУЩЕНО (Ліміт: від $MIN_CONTAINERS до $MAX_CONTAINERS серверів)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$currentScale = $MIN_CONTAINERS
$idleCounter = 0

while ($true) {
    try {
        # Опитуємо стан черги та повідомляємо поточну кількість контейнерів
        $response = Invoke-RestMethod -Uri "$($API_URL)?activeContainers=$currentScale" -Method Get -TimeoutSec 3
        $running = $response.runningTasks
        $queued = $response.queuedTasks

        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Контейнерів: $currentScale/$MAX_CONTAINERS | Активних задач: $running | У черзі: $queued" -ForegroundColor Gray

             if ($queued -gt 0 -or $running -ge $currentScale) {
            $idleCounter = 0
            if ($currentScale -lt $MAX_CONTAINERS) {
                $currentScale++
                Write-Host ">>> [SCALE UP] Високе навантаження! Автоматичний запуск нового контейнера backend (Тепер: $currentScale із $MAX_CONTAINERS)..." -ForegroundColor Green
                docker compose up -d --scale backend=$currentScale --no-recreate | Out-Null
                docker exec chess-load-balancer nginx -s reload | Out-Null
            }
            else {
                Write-Host "!!! [MAX LIMIT] Всі $MAX_CONTAINERS/$MAX_CONTAINERS серверів запущено! Максимальний ліміт вичерпано, задачі чекають у черзі." -ForegroundColor Yellow
            }
        }
        # Логіка SCALE IN (Зменшення кількості контейнерів при простої)
        elseif ($running -eq 0 -and $queued -eq 0 -and $currentScale -gt $MIN_CONTAINERS) {
            $idleCounter++
            if ($idleCounter -ge 4) { # Якщо ~12 секунд немає задач
                $currentScale--
                $idleCounter = 0
                Write-Host "<<< [SCALE DOWN] Навантаження спало. Зупинка зайвого контейнера (Залишилось: $currentScale із $MAX_CONTAINERS)..." -ForegroundColor Magenta
                docker compose up -d --scale backend=$currentScale --no-recreate | Out-Null
                docker exec chess-load-balancer nginx -s reload | Out-Null
            }
        }
        else {
            $idleCounter = 0
        }
    }
    catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Очікування готовності кластера..." -ForegroundColor DarkGray
    }

    Start-Sleep -Seconds 3
}
param()

$BASE_URL = "https://hvpnhylnaqrvmhzhddfn.supabase.co"

# Read service role key from .env.local
$SERVICE_KEY = $null
$envFile = Join-Path $PSScriptRoot "..\\.env.local"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^SUPABASE_SERVICE_ROLE_KEY=(.+)$') {
            $SERVICE_KEY = $Matches[1].Trim()
        }
    }
}

if (-not $SERVICE_KEY) {
    Write-Error "SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
    exit 1
}

$headers = @{
    "apikey"        = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=minimal"
}

Write-Host ""
Write-Host "CareQ - Database Cleanup" -ForegroundColor Cyan
Write-Host "Removing all transactional records..." -ForegroundColor Cyan
Write-Host ""

$tables = @(
    @{ name = "patient_sessions"; filter = "expires_at=gte.1900-01-01" },
    @{ name = "queue";            filter = "id=gte.0" },
    @{ name = "audit_log";        filter = "id=gte.0" },
    @{ name = "checkins";         filter = "checkin_id=gte.0" },
    @{ name = "patients";         filter = "id=gte.0" },
    @{ name = "rate_limits";      filter = "id=gte.0" },
    @{ name = "doctor_blocks";    filter = "id=gte.0" },
    @{ name = "doctor_schedules"; filter = "id=gte.0" }
)

foreach ($t in $tables) {
    $uri = "$BASE_URL/rest/v1/$($t.name)?$($t.filter)"
    try {
        Invoke-RestMethod -Method Delete -Uri $uri -Headers $headers -ErrorAction Stop | Out-Null
        Write-Host "  [OK]   $($t.name)" -ForegroundColor Green
    }
    catch {
        Write-Host "  [FAIL] $($t.name) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done. Reference data and staff accounts are untouched." -ForegroundColor Cyan
Write-Host ""

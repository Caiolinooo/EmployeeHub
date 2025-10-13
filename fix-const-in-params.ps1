# Lista de arquivos com erro
$files = @(
    "src\components\Auth\ProtectedRoute.tsx",
    "src\components\Auth\TokenExpirationNotifier.tsx",
    "src\components\avaliacao\InterfaceAprovacaoGerente.tsx",
    "src\components\avaliacao\PopupNotificacaoAvaliacao.tsx",
    "src\components\payroll\EmployeeList.tsx",
    "src\components\payroll\PayrollCalculator.tsx",
    "src\components\Profile\PreferencesTab.tsx",
    "src\components\AutomationSettings.tsx",
    "src\components\CurrencyInput.tsx",
    "src\components\IconSelector.tsx",
    "src\components\NetworkStatus.tsx",
    "src\components\ReimbursementIconSelector.tsx"
)

$filesFixed = 0

foreach ($file in $files) {
    $fullPath = Join-Path $PWD $file
    
    if (Test-Path $fullPath) {
        Write-Host "Corrigindo: $file" -ForegroundColor Yellow
        
        $content = Get-Content $fullPath | Out-String
        $originalContent = $content
        
        # Padrão: function Name({\n  const { t } = useI18n();\n children }: Props)
        # Corrigir para: function Name({ children }: Props) {\n  const { t } = useI18n();
        
        # Remover const { t } = useI18n(); de dentro dos parâmetros
        $content = $content -replace '(\w+\s*\(\s*\{)\s*const\s+\{\s*t\s*\}\s*=\s*useI18n\(\);\s*', '$1'
        
        # Remover linhas vazias extras que podem ter sobrado
        $content = $content -replace '\{\s+\n\s+([a-zA-Z_])', '{ $1'
        
        if ($content -ne $originalContent) {
            $content | Set-Content $fullPath -NoNewline
            Write-Host "  Corrigido!" -ForegroundColor Green
            $filesFixed++
        } else {
            Write-Host "  Nenhuma alteracao necessaria" -ForegroundColor Gray
        }
    } else {
        Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Concluido! Arquivos corrigidos: $filesFixed" -ForegroundColor Cyan


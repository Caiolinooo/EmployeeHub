# Script para corrigir todos os padrões {t( incorretos
$filesFixed = 0
$totalReplacements = 0

# Função para corrigir um arquivo
function Fix-File {
    param([string]$filePath)
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $originalContent = $content
        $replacements = 0
        
        # Padrão 1: return {t('...')}
        $pattern1 = 'return\s+\{t\('
        if ($content -match $pattern1) {
            $content = $content -replace 'return\s+\{t\(([^\)]+)\)\}', 'return t($1)'
            $replacements++
        }
        
        # Padrão 2: ? {t('...')} :
        $pattern2 = '\?\s*\{t\('
        if ($content -match $pattern2) {
            $content = $content -replace '\?\s*\{t\(([^\)]+)\)\}', '? t($1)'
            $replacements++
        }
        
        # Padrão 3: : {t('...')}
        $pattern3 = ':\s*\{t\('
        if ($content -match $pattern3) {
            $content = $content -replace ':\s*\{t\(([^\)]+)\)\}', ': t($1)'
            $replacements++
        }
        
        # Padrão 4: confirm({t('...')})
        $pattern4 = 'confirm\(\{t\('
        if ($content -match $pattern4) {
            $content = $content -replace 'confirm\(\{t\(([^\)]+)\)\}\)', 'confirm(t($1))'
            $replacements++
        }
        
        # Padrão 5: setSuccess({t('...')})
        $pattern5 = 'setSuccess\(\{t\('
        if ($content -match $pattern5) {
            $content = $content -replace 'setSuccess\(\{t\(([^\)]+)\)\}\)', 'setSuccess(t($1))'
            $replacements++
        }
        
        # Padrão 6: throw new Error({t('...')})
        $pattern6 = 'throw new Error\(\{t\('
        if ($content -match $pattern6) {
            $content = $content -replace 'throw new Error\(\{t\(([^\)]+)\)\}\)', 'throw new Error(t($1))'
            $replacements++
        }
        
        # Padrão 7: name: {t('...')}
        $pattern7 = 'name:\s*\{t\('
        if ($content -match $pattern7) {
            $content = $content -replace 'name:\s*\{t\(([^\)]+)\)\}', 'name: t($1)'
            $replacements++
        }
        
        # Padrão 8: description: {t('...')}
        $pattern8 = 'description:\s*\{t\('
        if ($content -match $pattern8) {
            $content = $content -replace 'description:\s*\{t\(([^\)]+)\)\}', 'description: t($1)'
            $replacements++
        }
        
        if ($content -ne $originalContent) {
            Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
            Write-Host "✅ $filePath - $replacements padrões corrigidos" -ForegroundColor Green
            $script:filesFixed++
            $script:totalReplacements += $replacements
            return $true
        }
        
        return $false
    }
    catch {
        Write-Host "❌ Erro ao processar $filePath : $_" -ForegroundColor Red
        return $false
    }
}

# Processar todos os arquivos .tsx e .ts em src
Write-Host "Corrigindo padroes t( incorretos..." -ForegroundColor Cyan
Write-Host ""

Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | ForEach-Object {
    Fix-File -filePath $_.FullName
}

Write-Host ""
Write-Host "Concluido!" -ForegroundColor Green
Write-Host "Arquivos corrigidos: $filesFixed" -ForegroundColor Yellow
Write-Host "Total de substituicoes: $totalReplacements" -ForegroundColor Yellow


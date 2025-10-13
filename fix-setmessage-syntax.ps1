# Corrigir setMessage({t( para setMessage(t(
$filesFixed = 0
$totalReplacements = 0

Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | ForEach-Object {
    $content = Get-Content $_.FullName | Out-String
    $originalContent = $content
    
    # Padrão: setMessage({t('...')}) -> setMessage(t('...'))
    $content = $content -replace 'setMessage\(\{t\(', 'setMessage(t('
    $content = $content -replace 'setError\(\{t\(', 'setError(t('
    $content = $content -replace 'setSuccess\(\{t\(', 'setSuccess(t('
    $content = $content -replace 'setWarning\(\{t\(', 'setWarning(t('
    
    if ($content -ne $originalContent) {
        $content | Set-Content $_.FullName -NoNewline
        Write-Host "Corrigido: $($_.FullName)" -ForegroundColor Green
        $filesFixed++
        
        # Contar quantas substituições foram feitas
        $matches = ([regex]::Matches($originalContent, 'set(Message|Error|Success|Warning)\(\{t\(')).Count
        $totalReplacements += $matches
    }
}

Write-Host ""
Write-Host "Concluido! Arquivos corrigidos: $filesFixed" -ForegroundColor Cyan
Write-Host "Total de substituicoes: $totalReplacements" -ForegroundColor Cyan


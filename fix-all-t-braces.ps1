# Script para corrigir TODOS os padrões {t( que não deveriam ter chaves
$filesFixed = 0
$totalReplacements = 0

Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | ForEach-Object {
    $content = Get-Content $_.FullName | Out-String
    $originalContent = $content
    
    # Padrões problemáticos:
    # 1. === {t('...')} -> === t('...')
    $content = $content -replace '===\s*\{t\(', '=== t('
    
    # 2. feedback.push({t('...')}) -> feedback.push(t('...'))
    $content = $content -replace 'feedback\.push\(\{t\(', 'feedback.push(t('
    
    # 3. case {t('...')}: -> case t('...')  (remover completamente)
    $content = $content -replace 'case\s+\{t\([^)]+\)\}:', ''
    
    # 4. ) : ({t('...')}) -> ) : (t('...'))
    $content = $content -replace '\)\s*:\s*\(\s*\{t\(', ') : (t('
    
    # 5. console.log({t('...')}) -> console.log(t('...'))
    $content = $content -replace 'console\.(log|error|warn|info)\(\{t\(', 'console.$1(t('
    
    if ($content -ne $originalContent) {
        $content | Set-Content $_.FullName -NoNewline
        Write-Host "Corrigido: $($_.FullName)" -ForegroundColor Green
        $filesFixed++
        
        # Contar quantas substituições foram feitas
        $matches = ([regex]::Matches($originalContent, '\{t\(')).Count
        $totalReplacements += $matches
    }
}

Write-Host ""
Write-Host "Concluido! Arquivos corrigidos: $filesFixed" -ForegroundColor Cyan
Write-Host "Total de substituicoes: $totalReplacements" -ForegroundColor Cyan


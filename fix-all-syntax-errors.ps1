# Script para encontrar e listar todos os erros de sintaxe comuns
$errors = @()

Write-Host "Procurando por erros de sintaxe..." -ForegroundColor Cyan

# Padrão 1: const { } dentro de parâmetros de função
Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | ForEach-Object {
    $content = Get-Content -Path $_.FullName -Raw
    
    # Procurar por function Name({ const { ou function Name({\n  const {
    if ($content -match 'function\s+\w+\s*\(\s*\{\s*const\s+\{') {
        $errors += @{
            File = $_.FullName
            Type = "const dentro de parametros de funcao"
            Pattern = "function Name({ const {"
        }
    }
}

# Padrão 2: Procurar por linhas que começam com const { dentro de ({ 
Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts | ForEach-Object {
    $lines = Get-Content -Path $_.FullName
    $inParams = $false
    $lineNum = 0
    
    foreach ($line in $lines) {
        $lineNum++
        
        # Detectar início de parâmetros de função
        if ($line -match 'function\s+\w+\s*\(\s*\{') {
            $inParams = $true
        }
        
        # Se estamos em parâmetros e encontramos const {
        if ($inParams -and $line -match '^\s*const\s+\{') {
            $errors += @{
                File = $_.FullName
                Type = "const { dentro de parametros"
                Line = $lineNum
                Content = $line.Trim()
            }
        }
        
        # Detectar fim de parâmetros
        if ($line -match '\}\s*\)\s*\{' -or $line -match '\}:\s*\w+\)\s*\{') {
            $inParams = $false
        }
    }
}

Write-Host ""
Write-Host "Erros encontrados: $($errors.Count)" -ForegroundColor Yellow
Write-Host ""

if ($errors.Count -gt 0) {
    foreach ($error in $errors) {
        Write-Host "Arquivo: $($error.File)" -ForegroundColor Red
        Write-Host "  Tipo: $($error.Type)" -ForegroundColor Yellow
        if ($error.Line) {
            Write-Host "  Linha: $($error.Line)" -ForegroundColor Yellow
            Write-Host "  Conteudo: $($error.Content)" -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    # Salvar em arquivo
    $errors | ConvertTo-Json | Out-File "syntax-errors-found.json"
    Write-Host "Erros salvos em syntax-errors-found.json" -ForegroundColor Green
} else {
    Write-Host "Nenhum erro encontrado!" -ForegroundColor Green
}


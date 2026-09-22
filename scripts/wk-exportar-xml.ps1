# Exporta os arquivos de dados do WK Radar para XML legível.
#
# O backup do Radar guarda os dados em XML criptografado: byte 0 = marca de
# criptografia, byte 1 = checksum, corpo cifrado. Quem sabe decifrar é a
# própria instalação do WK — este script carrega as DLLs dela e usa
# WK.Xml.XmlFileStream, que descriptografa na leitura.
#
# Abre SOMENTE em modo leitura e grava em outro diretório. Nunca escreve
# sobre a origem. Baseado no WKRadarExportador (carlosedunascimento), MIT.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\wk-exportar-xml.ps1 `
#     -Origem  "D:\Projeto\backup_wk" `
#     -Destino "D:\Projeto\backup_wk_xml" `
#     -Dlls    "D:\Projeto\WKRadar"
#
# RODE NO SERVIDOR onde o Radar está instalado e licenciado.
#
# Copiar as DLLs para outra máquina não basta. A partir da versão 7.21 a
# decifragem saiu do código gerenciado (na 7.4 era um XOR com alfabeto fixo,
# embutido na WK.Core) e foi para a WKLCoreCLI.dll nativa, que exige o
# ambiente registrado: sem ele, todo `Decript` devolve 0x80070005 (acesso
# negado) — inclusive em arquivo NÃO criptografado, o que mostra que a recusa
# é do componente, não do conteúdo.
#
# -Dlls aponta para a pasta de instalação (use a subpasta x64 se existir).

param(
  [Parameter(Mandatory = $true)][string]$Origem,
  [Parameter(Mandatory = $true)][string]$Destino,
  [string]$Dlls = 'D:\Projeto\WKRadar',
  [ValidateSet('v1', 'v2', 'v3')][string]$Versao = 'v2',
  [string]$Filtro = '*.xml'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Origem))  { throw "Origem não encontrada: $Origem" }
if (-not (Test-Path $Dlls))    { throw "Diretório de DLLs não encontrado: $Dlls" }
$core = Join-Path $Dlls 'WK.Core.dll'
if (-not (Test-Path $core))    { throw "WK.Core.dll não encontrada em $Dlls" }
$destinoResolvido = Resolve-Path -ErrorAction SilentlyContinue $Destino
if ($destinoResolvido -and (Resolve-Path $Origem).Path -eq $destinoResolvido.Path) {
  throw 'Destino não pode ser igual à origem.'
}

$script:dllDir = (Resolve-Path $Dlls).Path

# WKLCoreCLI é assembly misto e importa dezenas de DLLs nativas do ERP. Quem
# resolve essas é o loader do Windows, não o .NET — daí SetDllDirectory.
Add-Type -Namespace Win32 -Name Ldr -MemberDefinition @'
[DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
public static extern bool SetDllDirectory(string lpPathName);
'@
[void][Win32.Ldr]::SetDllDirectory($script:dllDir)
$env:PATH = $script:dllDir + ';' + $env:PATH

# As DLLs .NET da WK se referenciam entre si e não estão no diretório do processo.
$script:cache = @{}
$script:cache['WK.Core'] = [System.Reflection.Assembly]::UnsafeLoadFrom($core)
$handler = [System.ResolveEventHandler] {
  param($s, $e)
  $nome = ($e.Name -split ',')[0]
  if ($script:cache.ContainsKey($nome)) { return $script:cache[$nome] }
  $p = Join-Path $script:dllDir ($nome + '.dll')
  if (Test-Path $p) {
    $a = [System.Reflection.Assembly]::UnsafeLoadFrom($p)
    $script:cache[$nome] = $a
    return $a
  }
  return $null
}
[System.AppDomain]::CurrentDomain.add_AssemblyResolve($handler)

$cs = @'
using System;
using System.IO;
using WK;
using WK.Xml;

public static class WkLeitor
{
    /// Le o arquivo ja descriptografado. Somente leitura.
    public static byte[] LerBytes(string caminho, VersaoArquivo versao)
    {
        XmlFileStream fs = XmlFileStream.Abre(caminho, ModoAbrirArquivo.Leitura, versao);
        try
        {
            int num = (int)fs.Length;
            // Arquivo criptografado: 2 bytes de cabecalho (marca + checksum).
            if (fs.Encriptado) { num -= 2; fs.Seek(2L, SeekOrigin.Begin); }
            if (num <= 0) return new byte[0];
            byte[] buffer = new byte[num];
            int lidos = fs.Read(buffer, 0, num);
            if (lidos != num) Array.Resize(ref buffer, lidos);
            return buffer;
        }
        finally { fs.Close(); }
    }
}
'@
Add-Type -TypeDefinition $cs -ReferencedAssemblies $core -Language CSharp

$versaoEnum = [System.Enum]::Parse($script:cache['WK.Core'].GetType('WK.VersaoArquivo'), $Versao)
$raizOrigem = (Resolve-Path $Origem).Path.TrimEnd('\')
if (-not (Test-Path $Destino)) { New-Item -ItemType Directory -Path $Destino -Force | Out-Null }
$raizDestino = (Resolve-Path $Destino).Path.TrimEnd('\')

$arquivos = Get-ChildItem -Path $raizOrigem -Filter $Filtro -Recurse -File
Write-Host ("Arquivos a processar: " + $arquivos.Count)

$ok = 0; $falhas = 0; $erros = @()
foreach ($a in $arquivos) {
  $relativo = $a.FullName.Substring($raizOrigem.Length).TrimStart('\')
  $saida = Join-Path $raizDestino $relativo
  try {
    $bytes = [WkLeitor]::LerBytes($a.FullName, $versaoEnum)
    # O WK declara utf-7 no prólogo, mas grava texto de 1 byte por caractere.
    $texto = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
    $texto = $texto.Replace('"utf-7"', '"utf-8"')
    $dir = Split-Path $saida -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($saida, $texto, [System.Text.Encoding]::UTF8)
    $ok++
  } catch {
    $ex = $_.Exception
    while ($ex.InnerException) { $ex = $ex.InnerException }
    $falhas++
    if ($erros.Count -lt 10) { $erros += ($relativo + ' :: ' + $ex.Message) }
  }
  if ((($ok + $falhas) % 500) -eq 0) { Write-Host ("  ... " + ($ok + $falhas) + "/" + $arquivos.Count) }
}

Write-Host ''
Write-Host ("Exportados: " + $ok)
Write-Host ("Falhas:     " + $falhas)
foreach ($e in $erros) { Write-Host ('  ' + $e) }

if ($erros -match '2147024891') {
  Write-Host ''
  Write-Host 'DIAGNOSTICO: -2147024891 (0x80070005) vem de'
  Write-Host '  CWKCriptografiaXML::PodeRealizarCriptografia — o componente nativo'
  Write-Host '  recusou decifrar. Acontece fora do ambiente WK instalado/licenciado.'
  Write-Host '  Rode na máquina do Radar; se persistir, o check exige sessão WK'
  Write-Host '  autenticada e o caminho passa a ser exportar relatório pelo Radar.'
  Write-Host '  Detalhes em WKProfilerErros_Pgms_AAAAMM.log (gerado neste diretório).'
}
Write-Host ("Destino:    " + $raizDestino)
Write-Host 'WK_EXPORTAR_XML_OK'

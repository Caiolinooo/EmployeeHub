# RELATÓRIO — Documentos trocados no módulo Gestão de Tripulantes
Data: 2026-08-25 · Branch: portal · Base: Supabase produção (service-role, scripts em scratch/)

## Números (varredura `scratch/gt-risk-scan-v2.js` sobre dados reais)
| Métrica | Valor |
|---|---|
| Documentos vivos analisados | 1018 |
| Docs de tipo com CPF esperado vinculados SEM prova de identidade (cpf_documento ≠ perfil) | 70 |
| **Bucket A — nome do arquivo aponta para OUTRA pessoa (confirmados)** | **5** |
| Bucket A2 — tokens zerados vs. colaborador | 0 |
| Bucket B — nome PRÓPRIO no arquivo, sem CPF extraído (mantidos, identity_match corrigido) | 61 |
| Bucket C — sem nenhuma prova (título genérico, sem CPF) → quarentena | 4 |
| **Postos em QUARENTENA (A + C)** | **9** |
| Grupos duplicados (mesmo colaborador+tipo+título) visíveis na Auditoria | 44 grupos / 121 linhas excedentes |

## Evidência dos 5 casos confirmados de pessoa errada
| documento_id | Arquivo | Perfil onde estava | Dono real aparente |
|---|---|---|---|
| 88f756bc | ASO - Wendel Oliveira Silva - ASO PT EN | ADALBERTO OLIVEIRA VIEIRA | Wendel/Evanio Silva de Oliveira |
| f463288d | ASO - Vinicius Pereira de Oliveira …_rotated | ADALBERTO OLIVEIRA VIEIRA | VINICIUS PEREIRA DE OLIVEIRA |
| 884237d6 | ASO - Vinicius Pereira de Oliveira …_rotated | GABRIELA VALENTIM DE MORAES | VINICIUS PEREIRA DE OLIVEIRA |
| e45ffbcb | ASO - Vinicius Pereira de Oliveira …_rotated | GABRIELA VALENTIM DE MORAES | VINICIUS PEREIRA DE OLIVEIRA |
| 1063f3b2 | ASO - Vinicius Pereira de Oliveira …_rotated | GABRIELA VALENTIM DE MORAES | VINICIUS PEREIRA DE OLIVEIRA |

Bucket C (sem prova nenhuma): 284c423a "ASO" @Caio, 5932aed1 "ASO" @Vinicius,
9128ea4b "Passaporte" @Vinicius, 81cf48ad "Passaporte" @Ericka.

## Quarentena aplicada (`scratch/gt-quarantine-apply.js`, backup prévio em `scratch/backup-gt-quarantine-*.json`)
Contrato AGENTS.md: `gt_documentos.identity_match='quarantine'` + `colaborador_id=null`;
espelho ASO: `identity_match='quarantine'`, `esocial_status='quarentena'`.
- 9 docs desvinculados e marcados; verificação pós-update: perfil Adalberto ficou com **0** ASOs vivos;
  Gabriela manteve apenas os 9 ASOs com o próprio nome.
- Nota: 6 dos 9 não tinham linha em `gt_documentos_aso`; a criação de stub falhou por
  `tipo_exame` NOT NULL — o bloqueio fica garantido pelo doc-level (`identity_match='quarantine'`
  + rota 409), e o `resolver_quarentena` da Auditoria recria/atualiza o espelho na resolução manual.
- Bucket B: 61 docs com nome próprio mas sem CPF tiveram a mentira legada corrigida
  (`identity_match 'match' → 'unknown'`); vínculo mantido. Os 35 ASOs que continuam
  `match` têm `cpf_documento` batendo com o perfil (prova real).

## Duplicados (item 4)
- O "ASO - Vinicius" aparecia 2x no Adalberto no screenshot; hoje há apenas 1 linha viva dele
  nesse perfil (foi para quarentena). Não são duas linhas no banco para o Adalberto.
- Existem SIM clusters reais de linhas duplicadas (ex.: Ludmilla ~28x o mesmo título,
  Vinicius ~15x, Gabriela 9x, Caio 10x, Katia 4x). Todos já aparecem agrupados no bucket
  `duplicados` do GET `/api/gestao-tripulantes/auditoria` (chave colaborador+tipo+título),
  com ação ADMIN `mesclar_duplicados` pronta para uso — merge manual na Auditoria.

## Código alterado (tsc --noEmit: zero erros novos vs. baseline)
1. `src/app/api/gestao-tripulantes/documentos/[id]/esocial/route.ts` (POST)
   - Bloqueio duro **409** `ASO_CPF_NAO_EXTRAIDO` quando `cpf_documento`/OCR não tem CPF.
     Antes: sem CPF no doc, enviava usando o CPF do perfil (causa do evento errado).
2. `src/components/gestao-tripulantes/tabs/ASOTab.tsx`
   - `getOcrIdentity`: fallback legado `match==='match'` sem CPF removido (não é prova).
   - Botão "Enviar para E-Social" desabilitado também quando CPF não extraído, com aviso
     visível "Execute o OCR / identidade não verificada" (+ tooltip com o motivo).
   - Guard extra no handler de envio (toast) para CPF ausente.
   - OCR: lê `identity_gate` da resposta e exibe toast de erro claro
     "⚠️ Documento enviado para QUARENTENA… resolva em Auditoria > Quarentena".
3. `src/app/api/gestao-tripulantes/documentos/upload/route.ts`
   - Insert nasce `identity_match='unknown'` (era `'match'` antes mesmo do OCR).

## Prevenção de reincidência
Upload → OCR automático → sem CPF ⇒ gate existente põe em quarentena + agora UI anuncia;
envio exige cpf_documento == perfil no backend (409) e na UI (botão morto + aviso);
upload não herda mais prova falsa.

## Arquivos gerados em scratch/
gt-risk-scan.js / gt-risk-scan-v2.js (varredura), gt-risk-scan-report.json / -v2.json (evidência),
backup-gt-quarantine-*.json (dump pré-UPDATE das 9 linhas), gt-quarantine-apply.js,
gt-quarantine-applied.log via stdout + gt-quarantine-verify.js (verificação pós-update).
NÃO tocado: man-schedule.

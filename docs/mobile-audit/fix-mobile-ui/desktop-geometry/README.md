# Prova de geometria desktop — PR #99

Método: `next build` + `next start` locais. Sem harness estático.

- **BASE** = `origin/portal` `71bd3534955a1478ecd31af3fef9aa662ead34bd`
- **HEAD** = merge `71bd3534` + correções (`git rev-parse HEAD` no commit desta pasta)
- Compilação no **mesmo path absoluto** `/tmp/geom-compile` (BASE, depois HEAD). Cópias de `.next` em `/tmp/geom-next/{base-same,head-same}`.
- Experimento de glifo: BASE de novo em `/tmp/geom-compile-alt`.
- Sessão/APIs só via `page.route` (`scripts/desktop-geometry-proof.mjs`).

## Arquivos

| Ficheiro | Conteúdo |
|---|---|
| `same-path-bboxes.json` / `same-path-table.md` | Geometria completa 1280 e 1440 |
| `same-path-modals-bboxes.json` / `same-path-modals-table.md` | Ficha / Confirmation / Language com seletor de painel (não overlay) |
| `two-path-base-bboxes.json` / `two-path-base-table.md` | BASE vs BASE, dois paths de compile |
| `same-path/<vp>/{base,head,heat}/` | PNG + `boxes.json` + heatmaps |
| `mobile-head/` | 390/375 no HEAD real |
| `mobile/swipe-esc.json` | KPI swipe + Esc |

## Resumo geometria (mesmo path)

Critério: bbox (x,y,w,h) dos elementos principais.

- `/login`, dashboard, GT lista, **GT escala** (toolbar + datas + scrollport), férias, reembolso, contracheque: **boxes iguais** em 1280 e 1440.
- Escala **1280**: `1134×390@(113,350)` nos dois lados. Datas na 2ª linha **nos dois** (`dateEnd.y=275`). É o `flex-wrap` da **portal**, limiar de 1280 — não é regressão HEAD.
- Escala **1440**: `1294×508@(113,332)`; datas na 1ª linha nos dois (`dateStart`/`dateEnd` y=213).
- ConfirmationModal: título/Cancelar/Excluir iguais. LanguageDialog: painel igual depois de ignorar overlay fullscreen.
- Ficha: `fichaTablist` / `fichaBody` / `fichaPanel` iguais. `modalClose` só no HEAD porque o X da portal **não** tem `aria-label="Fechar"`; o botão visual continua 32×32 no mesmo sítio do painel.

Tabela completa: `same-path-table.md`.

## Pixel restante (glifo / raster)

CSS/font do `.next` (6 ficheiros): **md5 idêntico** entre `base-same`, `base-alt` e `head-same`. Não houve reordenação de CSS por path neste ambiente (`/tmp/geom-compile` vs `/tmp/geom-compile-alt`).

| Par | login 1280 | login 1440 | dashboard | escala |
|---|---:|---:|---:|---:|
| mesmo path BASE×HEAD | 31 px (maxChannel 37) | **0 px** | 688 (maxCh 14–16) | 688 (maxCh 14) |
| dois paths BASE×BASE | 31 px (maxCh 37) | 37 px (maxCh 37) | **0 px** | **0 px** |

688 px com `maxChannel` 6–16 e **bbox iguais** = raster dentro da mesma caixa (Companion/ícones), não deslocamento de layout. login 1440 mesmo-path = 0 px.

QA em `79b9166d` via dois builds em paths diferentes + `flex-wrap` no limiar de 1280: HEAD quebrava e BASE não. Aqui, **mesmo path + mesmas fontes**: os dois quebram igual (ou não quebram igual). A classe desktop continua `flex items-end gap-2.5 w-full flex-wrap` (= portal). `max-lg:flex-nowrap` só <1024.

## Mobile 390 / 375 (HEAD `next start`)

| VP | lista table | KPI | escala | X ficha | X confirm |
|---|---|---|---|---|---|
| 390×844 | 118 px h | 366×72, scrollWidth 990 > 366, overflow-x auto | 364×422 @ y=390 | 44×44 | 44×44 |
| 375×812 | 118 px h | 351×72 | 349×406 @ y=410 | 44×44 | 44×44 |

Esc 390: Confirmation 2→0; Desligamento 4→2 (fecha o deslig, ficha fica); Fechamento DP 2→0.

## Helpers

Não mudaram vs `79b9166d`:

- `ModalCloseButton.tsx` md5 `5179e1f504553fe62e2c7ec7b360b9c1` git `75db4d37c3ec0b528ce09cb4037bc401ffca882f`
- `useEscapeToClose.ts` md5 `206d81d43a0748d0c045d6f713908702` git `b09e112b4872762f59f634574f514557fb5c76ff`
- bloco `@media (max-width: 767px)` md5 `95f52881a0e206b8f70c4e74960482ad`

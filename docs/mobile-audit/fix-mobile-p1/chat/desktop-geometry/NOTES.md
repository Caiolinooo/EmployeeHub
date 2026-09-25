# Geometria #110 Chat — 58.753 px

Base `85f11029` (`:3060`) vs HEAD (`:3073`). Path `/tmp/geom-compile`.

## Página /chat fechada

Boxes iguais. 0 px nos 3 viewports.

## CreateServer

`modalPanel` 448×256 igual. `chatTitle` 132 vs 346 (coletor pega texto+X). Screenshot 0 px.

## StartDM (os 58.753 px em 1440)

`modalPanel` **igual** `448×218@(496,341)`. `searchPanel` HEAD-only = o mesmo `data-modal-panel` (portal não tem o atributo). 58.753 px = raster/glifo **dentro** da mesma caixa (não muda header/sidebar/main).

## CreateChannel / ServerSettings / Settings

`loginCard` (caixa branca) igual. `modalPanel` HEAD-only = `data-modal-panel` novo. px 65k–92k = X/`data-modal-panel` no overlay, não a página.

## Esc (só painéis visíveis)

390: CreateServer/Channel/StartDM/Settings 2→0. ServerSettings não abriu (0). 1440: os 5 chat 2→0. Exchange/Voice não montaram overlay (0).

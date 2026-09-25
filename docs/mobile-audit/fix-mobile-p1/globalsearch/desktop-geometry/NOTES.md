# Geometria #109 GlobalSearch

Base `85f11029` (`:3060`) vs HEAD (`:3072`). Path `/tmp/geom-compile`.

Login/dashboard: boxes iguais. px 0 (dashboard 1024 = 61 AA).

`globalsearch-ctrlk` no desktop: screenshot 0 px. `searchPanel`/`modalPanel` NÃO são o overlay — o coletor pega o input do dashboard (576×60). GlobalSearch vive em `MainLayout` `md:hidden`; Ctrl+K no desktop não pinta overlay. Busca no header é só mobile.

Mobile 390/375: X 44×44, Esc 3→0.

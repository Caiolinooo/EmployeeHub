# Catálogo global de documentos do colaborador — DOX

## Purpose

Resolver vivo que, dado um colaborador (portal `users_unified` e/ou `gt_colaboradores`), descobre documentos nos módulos conhecidos e os lista sem copiar blobs.

## Ownership

- Lib: `src/lib/document-catalog/`
- API: `GET /api/document-catalog`, `GET /api/users/[id]/documents`, `GET /api/document-catalog/download`
- UI: `src/components/admin/CollaboratorDocumentsCatalog.tsx`
- Aba QHSE: `src/components/gestao-tripulantes/tabs/QhseTab.tsx` (modal GT), `/profile` aba QHSE / EPI, UserEditor seção QHSE

## Local Contracts

- Sem tabela de índice: cada fonte consulta o registro original. Download aponta para URL/`arquivo_url` existente ou gera ficha EPI sob demanda.
- Matching portal↔GT: `gt.user_id` → `users_unified.tax_id` (dígitos + máscara; **nunca** selecionar `cpf` / `full_name` / `phone` em `users_unified`) → e-mail → telefone (dígitos / últimos 8) → nome único corroborado (`namesCorroborate`). Sem GT, o usuário do portal ainda resolve (lista vazia, não 404). 404 só se user e colaborador forem ambos irresolvíveis.
- Select de `gt_colaboradores` (`CATALOG_COLAB_SELECT`) só usa colunas reais da tabela + embed `cargo:gt_cargos(nome)`. **Nunca** aliases da view (`cargo_nome`, `empresa_nome`, `embarcacao_nome`, `centro_custo_nome`, `cargo_nivel`, `cargo_ordem`) — existem só em `gt_vw_colaboradores_completo`; PostgREST falha e a aba QHSE / EPI devolve 404 `Colaborador não encontrado` mesmo com o id válido da ficha. `catalogColabSelectIsSafe` rejeita esses aliases. Todo `.select(CATALOG_COLAB_SELECT)` em `identity.ts` passa por `flattenCatalogColabRow` (`cargo.nome` → `cargo_nome`). Sem UI nesta correção.
- **QHSE/EPI na ficha do colaborador**: aba própria **QHSE / EPI** (não dump em Documentos). Módulo-chave `epi` (`QHSE_MODULE_KEY`) — o mesmo checkbox “EPI” em `/admin/users` → Configurar permissões → Módulos do Sistema. Sem ACL extra de catálogo (`lista-presenca.manage` / `gestao-tripulantes.view`). ADMIN/MANAGER sempre veem. USER só com `modules.epi === true` (ou default do role se a flag individual não existir).
- Query `?qhse=1` / `onlyQhse` devolve só itens QHSE (`qhseRelated` ou `category === 'qhse'`), **exceto ASO/laudo**. `qhseRelated` é false para `tipo_documento` aso/laudo (`qhseFlagsForGtTipo`). `isQhseCatalogDocument` também rejeita `tipoDocumento`/`category` aso|laudo mesmo se uma fonte marcar QHSE. Exames ocupacionais ficam na aba ASO do modal GT.
- Não alterar agrupamento de Treinamentos/CBSP no GT. A aba Documentos do GT é só `gt_documentos` + Histórico colapsável.

## Work Guidance

Registrar fonte futura (código, sem over-engineering):

1. Criar `src/lib/document-catalog/sources/<modulo>.ts`
2. Chamar `registerDocumentSource({ id, label, qhseRestricted, collect })`
3. Importar o arquivo em `sources/index.ts`
4. Incluir o `id` em `DOCUMENT_CATALOG_SOURCE_IDS` e tratar no `switch` de `permissions.ts` e `download/route.ts`

`collect` recebe `CatalogSourceContext` (`identity` + `canSeeQhse`) e devolve `CatalogDocument[]` (referências, não bytes).

## Verification

- `npx tsx --test src/lib/document-catalog/document-catalog.test.ts src/config/modules.test.ts src/lib/gestao-tripulantes/validade-civil.test.ts`
- `CATALOG_COLAB_SELECT` passa `catalogColabSelectIsSafe` (sem aliases da view). `flattenCatalogColabRow` mapeia `cargo.nome` → `cargo_nome`.
- Modal GT com módulo `epi`: aba **QHSE / EPI** lista ficha AN-HSE-005 e listas QHSE e **não** lista ASO/laudo. Sem o módulo, a aba não aparece.
- `/admin/users` → editor: seção QHSE se o admin/editor tem `epi`; permissões do colaborador editado = checkbox EPI.
- `/profile` → aba QHSE / EPI só com `hasAccess('epi')`. Documentos genéricos usam `hideQhse`.
- USER com `epi: false` não lista EPI de outro colaborador mesmo com ACL de lista-presença/GT.

## Child DOX Index

_(none)_

-- Departamento WK: `codigo` e `nome` separados; rótulo "NN - NOME" derivado.
-- Causa do bug "38 - 38 - X": nome gravado já com o código ("38 - ABZ - MATRIX") e o rótulo
-- prefixava `codigo` de novo. Idempotente: reexecutar não altera nada.

-- 1) gt_departamentos.nome sem o prefixo do código (inclui prefixos repetidos).
UPDATE public.gt_departamentos d
SET nome = btrim(regexp_replace(d.nome, '^\s*(' || d.codigo || '\s*-\s*)+', '')),
    updated_at = now()
WHERE d.codigo ~ '^\d{1,10}$'
  AND d.nome ~ ('^\s*' || d.codigo || '\s*-\s*')
  AND btrim(regexp_replace(d.nome, '^\s*(' || d.codigo || '\s*-\s*)+', '')) <> '';

-- 2) gt_colaboradores.departamento (rótulo persistido) recalculado a partir do FK.
UPDATE public.gt_colaboradores c
SET departamento = d.codigo || ' - ' || d.nome
FROM public.gt_departamentos d
WHERE c.departamento_id = d.id
  AND d.codigo IS NOT NULL AND d.nome IS NOT NULL
  AND c.departamento IS DISTINCT FROM (d.codigo || ' - ' || d.nome);

-- 3) Texto legado sem FK: colapsa "NN - NN - X" para "NN - X".
UPDATE public.gt_colaboradores
SET departamento = regexp_replace(departamento, '^\s*(\d{1,10})\s*-\s*(\1\s*-\s*)+', '\1 - ')
WHERE departamento_id IS NULL
  AND departamento ~ '^\s*(\d{1,10})\s*-\s*\1\s*-';

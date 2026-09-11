const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Let's inspect each collaborator's ASO history carefully:
  // 1. Vinicius: Keep b5419e1f-d197-4aee-9aa0-a34874fa6e8b (Admissional 2026-05-04, Processado no e-Social)
  //    Remove 1a71b2ac (duplicate of b5419), 6e58a1f0 (ocr erro), 621be217 (failed test)
  // 2. Ludmilla:
  //    - 87162b6b-7e4e-49a1-9e65-a509696b3133 (Admissional 2023-06-08) -> KEEP
  //    - 64c0a71c-755c-4b69-9da9-3172e20c2a9b (Periódico 2024-05-04) -> KEEP
  //    - 05dc7c18-c44d-400b-96fd-8f593210876e (Periódico 2024-06-06) -> KEEP
  //    - 43f0b7bd-b56f-419b-af93-b40a4e3f5d53 (Periódico 2024-08-04) -> KEEP
  //    - 7323407e-abe2-4d81-a185-41472d74802d (Periódico 2026-05-25, Processado no e-Social) -> KEEP
  //    - Remove 96b954dd, f0419613, 18b3ec9b (test uploads without OCR/meta)
  // 3. Caio Correia:
  //    - 7b122ce3-bfe1-4a44-826e-1d9c38134bc4 (Admissional 2025-03-17, CRM 528045641) -> KEEP
  //    - Remove 1a066476, 2f89c898 (duplicate drafts of 7b122ce3), remove 3c780dde (ocr erro test)
  // 4. Gabriela Valentim:
  //    - ff646d3f-cd12-41c5-bf73-a56550db2ab1 (Periódico 2026-06-01, Processado no e-Social) -> KEEP
  //    - Remove 557bba41 (test upload without OCR)
  // 5. Katia Amorim:
  //    - 04555531-a0dd-44d6-bdf0-9beb5a36fc72 (Periódico 2026-05-06 / 2027-05-06) -> KEEP
  //    - Remove 73efc13d (test upload with ocr erro)
  // 6. Renan Maia:
  //    - c69df878-faa2-4c36-9e10-0e6ea45cbffe (Periódico 2026-08-10) -> KEEP
  // 7. Matheus Cabral:
  //    - 05a1f105-7332-496b-bffa-1388762e14b4 (Admissional 2026-05-22, Processado) -> KEEP
  // 8. Viviana Machado:
  //    - 5856bacc-c08f-4f2f-8288-72ff7064af88 (Periódico 2026-05-13, Processado) -> KEEP
  // 9. Alana Nunes:
  //    - b2d8b1ee-56cd-4990-afcf-6c8e6e459f13 (Demissional 2026-06-12, Processado) -> KEEP
  // 10. Lourival Alves:
  //    - df624490-3916-4009-8b1d-ea971e59007b (Admissional 2026-06-12) -> KEEP
  // 11. Anderson Pinto:
  //    - ea25f252-4e30-407b-9d7a-4ed8dbc37d0e (Periódico 2026-08-12, Processado) -> KEEP
  // 12. Ericka Relvas:
  //    - e6495d2e-f013-461c-8345-2eec95f0ab02 (Admissional 2026-04-06) -> KEEP
  // 13. Quarentena (Orfãos):
  //    - 88f756bc-1b73-42b6-aa82-c088c6ee75ae (Wendel Oliveira Silva) -> KEEP (Quarentena)
  //    - Remove test scraps: 5932aed1, f463288d, e45ffbcb, 884237d6

  const duplicateIdsToRemove = [
    // Vinicius duplicates
    '1a71b2ac-1816-4d8b-adac-0bcc941ca61a',
    '6e58a1f0-d851-404f-b3ac-9f5e3ac2f55e',
    '621be217-5686-4183-9dfb-e3d7656daeb9',
    // Ludmilla test duplicates
    '96b954dd-258c-41b3-b40d-728b6f7925a8',
    'f0419613-5769-49af-a026-3438125d5e2a',
    '18b3ec9b-b46d-46a4-97d7-cd64da36fb56',
    // Caio duplicate drafts / test
    '1a066476-2b17-4495-850b-c71e578a5bcf',
    '2f89c898-b7e2-40dc-a780-0beda92c0cc9',
    '3c780dde-b2d1-428e-be43-9d8f63792291',
    // Gabriela test duplicate
    '557bba41-2449-4098-9f16-704ef8a9f412',
    // Katia test duplicate
    '73efc13d-0de3-481b-ae50-9a77006df688',
    // Test scraps in orphan
    '5932aed1-80b3-4920-b6e6-b3ed22c52bb7',
    'f463288d-8bb3-45ff-acae-0a7076fccef5',
    'e45ffbcb-ee55-4a60-9496-4e4eb2ac3b96',
    '884237d6-0d65-4cfd-b68e-730d17ec9ac8'
  ];

  console.log(`Soft-deleting ${duplicateIdsToRemove.length} residual test duplicate ASOs...`);
  const now = new Date().toISOString();

  for (const id of duplicateIdsToRemove) {
    await supabase.from('gt_documentos').update({
      deleted_at: now,
      comentario_revisao: 'Duplicata de teste/rascunho mesclada',
      updated_at: now
    }).eq('id', id);

    await supabase.from('gt_documentos_aso').delete().eq('documento_id', id);
  }

  console.log('Cleanup finished.');
}

run();

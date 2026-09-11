const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectFullText() {
  const { data: doc } = await supabase
    .from('gt_documentos')
    .select('*')
    .eq('id', '7b122ce3-bfe1-4a44-826e-1d9c38134bc4')
    .single();

  console.log('=== FULL OCR TEXT ===');
  console.log(doc.ocr_texto);
  console.log('=== OCR DADOS EXTRAIDOS ===');
  console.log(doc.ocr_dados_extraidos);
}

inspectFullText();

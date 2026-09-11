const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const vinSecondaryId = '9fb58004-62d0-4c67-beaa-09693a108be8';
  const { error } = await supabase
    .from('gt_colaboradores')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', vinSecondaryId);

  if (error) {
    console.error('Error soft deleting secondary Vinicius:', error);
  } else {
    console.log('Secondary Vinicius soft-deleted successfully.');
  }
}

run();

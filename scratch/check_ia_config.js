const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkIAConfig() {
  const { data: config } = await supabase
    .from('ia_config')
    .select('*');

  console.log('IA Config:', config);
}

checkIAConfig();

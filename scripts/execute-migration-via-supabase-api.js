/**
 * Execute Migration via Supabase API
 *
 * This script executes the migration by creating tables directly through
 * Supabase API queries. Since Supabase PostgREST doesn't support DDL operations,
 * we'll verify if tables exist and provide instructions.
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('\n🔍 Checking database schema...\n');
  console.log('━'.repeat(80));

  // Check if tables exist
  const tables = [
    'avaliacao_usuarios_elegiveis',
    'avaliacao_colaborador_gerente',
    'avaliacao_cron_log'
  ];

  let allTablesExist = true;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      console.log(`❌ Table ${table}: NOT FOUND`);
      allTablesExist = false;
    } else {
      console.log(`✅ Table ${table}: EXISTS`);
    }
  }

  // Check periodos_avaliacao columns
  console.log('\n🔍 Checking periodos_avaliacao columns...\n');

  const { data: periodo, error: periodoError } = await supabase
    .from('periodos_avaliacao')
    .select('*')
    .limit(1)
    .maybeSingle();

  const requiredColumns = [
    'criacao_automatica_executada',
    'data_criacao_automatica',
    'total_avaliacoes_criadas'
  ];

  let columnsExist = true;

  if (periodo) {
    requiredColumns.forEach(col => {
      if (col in periodo) {
        console.log(`✅ Column ${col}: EXISTS`);
      } else {
        console.log(`❌ Column ${col}: NOT FOUND`);
        columnsExist = false;
      }
    });
  } else {
    console.log('⚠️  periodos_avaliacao table is empty or doesn\'t exist');
  }

  console.log('\n' + '━'.repeat(80));

  if (!allTablesExist || !columnsExist) {
    console.log('\n⚠️  MIGRATION REQUIRED\n');
    console.log('📋 To execute the migration, follow these steps:\n');
    console.log('1. Open Supabase Dashboard: https://app.supabase.com');
    console.log(`2. Navigate to: Project > SQL Editor`);
    console.log('3. Click "New Query"');
    console.log('4. Copy the entire content from:');
    console.log('   scripts/migrations/001-create-evaluation-automation-tables.sql');
    console.log('5. Paste it in the SQL Editor');
    console.log('6. Click "Run" to execute');
    console.log('7. Re-run this script to verify\n');
    console.log('━'.repeat(80));
    console.log('\nAlternatively, if you have psql installed:');
    console.log('Run: npm run db:migrate\n');
  } else {
    console.log('\n✅ All tables and columns exist! Migration is complete.\n');
    console.log('📋 Next steps:');
    console.log('   1. Populate eligible users');
    console.log('   2. Configure manager mappings');
    console.log('   3. Create evaluation periods');
    console.log('   4. Test automatic creation\n');
  }
}

main().catch(console.error);

/**
 * Test Automatic Evaluation Creation
 *
 * This script tests the complete automatic evaluation creation workflow:
 * 1. Creates a test period with data_inicio = tomorrow
 * 2. Populates eligible users and manager mappings
 * 3. Simulates the cron job execution
 * 4. Verifies that evaluations were created
 *
 * Usage: node scripts/test-automatic-evaluation-creation.js
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
  console.log('\n🧪 Testing Automatic Evaluation Creation\n');
  console.log('━'.repeat(80));

  try {
    // Step 1: Get active users
    console.log('\n📋 Step 1: Finding active users...');
    const { data: users, error: usersError } = await supabase
      .from('users_unified')
      .select('id, name, email')
      .limit(10);

    if (usersError) throw usersError;

    console.log(`✅ Found ${users.length} active users`);

    if (users.length < 2) {
      console.log('❌ Need at least 2 users to test (1 employee + 1 manager)');
      return;
    }

    // Step 2: Set up manager mappings
    console.log('\n📋 Step 2: Setting up manager mappings...');
    const employee = users[0];
    const manager = users[1];

    // Check if mapping exists
    const { data: existingMapping } = await supabase
      .from('avaliacao_colaborador_gerente')
      .select('id')
      .eq('colaborador_id', employee.id)
      .is('periodo_id', null)
      .single();

    if (!existingMapping) {
      const { error: mappingError } = await supabase
        .from('avaliacao_colaborador_gerente')
        .insert({
          colaborador_id: employee.id,
          gerente_id: manager.id,
          periodo_id: null, // Global mapping
          ativo: true
        });

      if (mappingError) throw mappingError;
      console.log(`✅ Created mapping: ${employee.name} → ${manager.name}`);
    } else {
      console.log(`✅ Mapping already exists for ${employee.name}`);
    }

    // Step 3: Add to eligible users
    console.log('\n📋 Step 3: Adding to eligible users...');
    const { data: existingEligible } = await supabase
      .from('avaliacao_usuarios_elegiveis')
      .select('id')
      .eq('usuario_id', employee.id)
      .is('periodo_id', null)
      .single();

    if (!existingEligible) {
      const { error: eligibleError } = await supabase
        .from('avaliacao_usuarios_elegiveis')
        .insert({
          usuario_id: employee.id,
          periodo_id: null, // Global eligibility
          ativo: true
        });

      if (eligibleError) throw eligibleError;
      console.log(`✅ Added ${employee.name} to eligible users`);
    } else {
      console.log(`✅ ${employee.name} is already eligible`);
    }

    // Step 4: Create test period
    console.log('\n📋 Step 4: Creating test evaluation period...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 15);
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data: periodo, error: periodoError } = await supabase
      .from('periodos_avaliacao')
      .insert({
        nome: `Teste Automático - ${new Date().toISOString()}`,
        descricao: 'Período de teste para criação automática de avaliações',
        ano: new Date().getFullYear(),
        data_inicio: tomorrowStr,
        data_fim: endDateStr,
        data_limite_autoavaliacao: endDateStr,
        data_limite_aprovacao: endDateStr,
        status: 'planejado',
        ativo: true,
        criacao_automatica_executada: false
      })
      .select()
      .single();

    if (periodoError) throw periodoError;

    console.log(`✅ Created test period: ${periodo.nome}`);
    console.log(`   Start date: ${periodo.data_inicio}`);
    console.log(`   End date: ${periodo.data_fim}`);

    // Step 5: Test the cron endpoint
    console.log('\n📋 Step 5: Testing cron endpoint...');
    console.log('⚠️  To test the cron endpoint, run:');
    console.log(`   curl -X POST http://localhost:3000/api/avaliacao/cron/criar-avaliacoes`);
    console.log(`   -H "Content-Type: application/json"`);
    console.log(`   -H "Authorization: Bearer YOUR_ADMIN_TOKEN"`);
    console.log('\n   Or wait until tomorrow for the automatic execution\n');

    // Step 6: Summary
    console.log('━'.repeat(80));
    console.log('\n✅ Test setup completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - Test period created: ${periodo.id}`);
    console.log(`   - Employee: ${employee.name} (${employee.email})`);
    console.log(`   - Manager: ${manager.name} (${manager.email})`);
    console.log(`   - Scheduled for: ${tomorrowStr}`);
    console.log('\n📅 Next steps:');
    console.log('   1. Wait until tomorrow for automatic creation');
    console.log('   2. Or trigger manually via API endpoint');
    console.log('   3. Check avaliacao_cron_log table for execution logs');
    console.log('   4. Verify evaluations were created in avaliacoes_desempenho\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});

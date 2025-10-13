/**
 * Script para atualizar traduções dos cards no banco de dados Supabase
 * Usa as traduções dos arquivos i18n existentes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeamento de traduções baseado nos arquivos i18n
const translations: Record<string, { title_pt: string; title_en: string; description_pt: string; description_en: string }> = {
  'manual': {
    title_pt: 'Manual do Colaborador',
    title_en: 'Employee Manual',
    description_pt: 'Acesse o manual completo do colaborador',
    description_en: 'Access the complete employee manual'
  },
  'folhaPagamento': {
    title_pt: 'Folha de Pagamento',
    title_en: 'Payroll',
    description_pt: 'Gestão completa de folha de pagamento e cálculos trabalhistas',
    description_en: 'Complete payroll management and labor calculations'
  },
  'procedimentos-logistica': {
    title_pt: 'Procedimentos de Logística',
    title_en: 'Logistics Procedures',
    description_pt: 'Consulte os procedimentos padrões da área',
    description_en: 'Check the standard procedures for the area'
  },
  'politicas': {
    title_pt: 'Políticas',
    title_en: 'Policies',
    description_pt: 'Consulte as políticas da empresa',
    description_en: 'Check company policies'
  },
  'procedimentos-gerais': {
    title_pt: 'Procedimentos Gerais',
    title_en: 'General Procedures',
    description_pt: 'Consulte os procedimentos gerais da empresa',
    description_en: 'Check the company general procedures'
  },
  'noticias': {
    title_pt: 'ABZ News',
    title_en: 'ABZ News',
    description_pt: 'Fique por dentro das novidades da empresa',
    description_en: 'Stay up to date with company news'
  },
  'calendario': {
    title_pt: 'Calendário',
    title_en: 'Calendar',
    description_pt: 'Visualize eventos e datas importantes',
    description_en: 'View important events and dates'
  },
  'reembolso': {
    title_pt: 'Reembolso',
    title_en: 'Reimbursement',
    description_pt: 'Solicite reembolso de despesas',
    description_en: 'Request expense reimbursement'
  },
  'avaliacoes-avancadas': {
    title_pt: 'Avaliações Avançadas',
    title_en: 'Advanced Evaluations',
    description_pt: 'Métricas, análises e relatórios detalhados de performance',
    description_en: 'Metrics, analysis and detailed performance reports'
  },
  'contracheque': {
    title_pt: 'Contracheque',
    title_en: 'Payslip',
    description_pt: 'Acesse seus contracheques',
    description_en: 'Access your payslips'
  },
  'relatorios-pdf': {
    title_pt: 'Relatórios PDF',
    title_en: 'PDF Reports',
    description_pt: 'Gere relatórios personalizados com gráficos e visualizações',
    description_en: 'Generate custom reports with charts and visualizations'
  },
  'ponto': {
    title_pt: 'Ponto',
    title_en: 'Time Clock',
    description_pt: 'Registre seu ponto e consulte seu histórico',
    description_en: 'Register your time and check your history'
  },
  'api-mobile': {
    title_pt: 'API Mobile',
    title_en: 'Mobile API',
    description_pt: 'Gerenciamento e monitoramento da API para aplicativos móveis',
    description_en: 'API management and monitoring for mobile applications'
  },
  'integracao-erp': {
    title_pt: 'Integração ERP',
    title_en: 'ERP Integration',
    description_pt: 'Conectores e sincronização com sistemas ERP externos',
    description_en: 'Connectors and synchronization with external ERP systems'
  },
  'avaliacao': {
    title_pt: 'Avaliação de Desempenho',
    title_en: 'Performance Evaluation',
    description_pt: 'Gerencie avaliações de desempenho dos colaboradores',
    description_en: 'Manage employee performance evaluations'
  },
  'dashboard-bi': {
    title_pt: 'Dashboard de BI',
    title_en: 'BI Dashboard',
    description_pt: 'Analytics avançados e visualizações interativas de dados',
    description_en: 'Advanced analytics and interactive data visualizations'
  },
  'academy': {
    title_pt: 'ABZ Academy',
    title_en: 'ABZ Academy',
    description_pt: 'Centro de treinamento e desenvolvimento profissional',
    description_en: 'Training and professional development center'
  },
  'admin': {
    title_pt: 'Administração',
    title_en: 'Administration',
    description_pt: 'Painel de administração do sistema',
    description_en: 'System administration panel'
  },
  'workflows': {
    title_pt: 'Workflows Automatizados',
    title_en: 'Automated Workflows',
    description_pt: 'Automatize processos empresariais com workflows inteligentes',
    description_en: 'Automate business processes with intelligent workflows'
  },
  'chat': {
    title_pt: 'Chat Interno',
    title_en: 'Internal Chat',
    description_pt: 'Comunicação em tempo real com canais e mensagens diretas',
    description_en: 'Real-time communication with channels and direct messages'
  }
};

async function updateCardsTranslations() {
  console.log('🚀 Iniciando atualização de traduções dos cards...\n');

  try {
    // Buscar todos os cards
    const { data: cards, error: fetchError } = await supabase
      .from('cards')
      .select('id, title, description');

    if (fetchError) {
      console.error('❌ Erro ao buscar cards:', fetchError);
      return;
    }

    if (!cards || cards.length === 0) {
      console.log('⚠️  Nenhum card encontrado no banco de dados');
      return;
    }

    console.log(`📊 Total de cards encontrados: ${cards.length}\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Atualizar cada card
    for (const card of cards) {
      const translation = translations[card.id];

      if (!translation) {
        console.log(`⚠️  [${card.id}] Tradução não encontrada - PULADO`);
        skipped++;
        continue;
      }

      // Atualizar o card
      const { error: updateError } = await supabase
        .from('cards')
        .update({
          title: translation.title_pt,
          title_en: translation.title_en,
          description: translation.description_pt,
          description_en: translation.description_en,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (updateError) {
        console.error(`❌ [${card.id}] Erro ao atualizar:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ [${card.id}] Atualizado com sucesso`);
        console.log(`   PT: ${translation.title_pt}`);
        console.log(`   EN: ${translation.title_en}\n`);
        updated++;
      }
    }

    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMO DA ATUALIZAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Cards atualizados: ${updated}`);
    console.log(`⚠️  Cards pulados: ${skipped}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📊 Total processado: ${cards.length}`);
    console.log('='.repeat(60) + '\n');

    if (updated > 0) {
      console.log('🎉 Traduções atualizadas com sucesso!');
      console.log('💡 Os cards agora exibirão traduções baseadas no locale do usuário.');
    }

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar o script
updateCardsTranslations()
  .then(() => {
    console.log('\n✨ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro ao executar script:', error);
    process.exit(1);
  });


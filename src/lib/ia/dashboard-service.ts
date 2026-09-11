/**
 * Serviço de Dashboard Inteligente da IA
 * Agrega dados de múltiplas fontes e gera KPIs, pendências e resumo
 */
import { supabaseAdmin } from '@/lib/supabase';
import { getEffectiveRole, getAccessibleUserIds } from './permissions';
import type {
  IADashboardData,
  IADashboardKPI,
  IADashboardPendency,
  IADashboardSummary,
  IAUserRole,
} from '@/types/ia';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

// =====================================================
// Cache
// =====================================================

/**
 * Buscar dashboard do cache
 */
async function getCachedDashboard(userId: string): Promise<IADashboardData | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('ia_dashboard_cache')
      .select('data, generated_at, expires_at')
      .eq('user_id', userId)
      .eq('dashboard_type', 'summary')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Verificar se expirou
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null;
    }

    return data.data as unknown as IADashboardData;
  } catch {
    return null;
  }
}

/**
 * Salvar dashboard no cache
 */
async function cacheDashboard(userId: string, dashboardData: IADashboardData): Promise<void> {
  try {
    // Deletar cache antigo
    await supabaseAdmin
      .from('ia_dashboard_cache')
      .delete()
      .eq('user_id', userId)
      .eq('dashboard_type', 'summary');

    // Inserir novo
    await supabaseAdmin
      .from('ia_dashboard_cache')
      .insert({
        user_id: userId,
        dashboard_type: 'summary',
        data: dashboardData as any,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      });
  } catch (err) {
    console.error('[IA Dashboard] Erro ao cachear:', err);
  }
}

// =====================================================
// Buscas de dados
// =====================================================

async function fetchEvaluationKPIs(
  userId: string,
  role: IAUserRole,
  accessibleIds: string[] | null
): Promise<IADashboardKPI[]> {
  const kpis: IADashboardKPI[] = [];

  try {
    let query = supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('nota_final, status, created_at, colaborador_id');

    if (accessibleIds) {
      query = query.in('colaborador_id', accessibleIds);
    }

    const { data } = await query.order('created_at', { ascending: false }).limit(50);

    if (data && data.length > 0) {
      const scores = data
        .filter((d: any) => d.nota_final != null)
        .map((d: any) => d.nota_final);

      if (scores.length > 0) {
        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        kpis.push({
          label: role === 'USER' ? 'Sua Nota Média' : 'Nota Média da Equipe',
          value: Math.round(avg * 10) / 10,
          icon: '📊',
          trend: 'stable',
        });
      }

      kpis.push({
        label: 'Total de Avaliações',
        value: data.length,
        icon: '📝',
      });

      const pending = data.filter((d: any) => d.status === 'pending' || d.status === 'em_andamento');
      if (pending.length > 0) {
        kpis.push({
          label: 'Avaliações Pendentes',
          value: pending.length,
          icon: '⏳',
        });
      }
    }
  } catch {
    // tabela pode não existir
  }

  return kpis;
}

async function fetchVacationKPIs(
  userId: string,
  accessibleIds: string[] | null
): Promise<IADashboardKPI[]> {
  const kpis: IADashboardKPI[] = [];

  try {
    let query = supabaseAdmin
      .from('leave_requests')
      .select('status, start_date, end_date, user_id');

    if (accessibleIds) {
      query = query.in('user_id', accessibleIds);
    }

    const { data } = await query
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(20);

    if (data && data.length > 0) {
      const pending = data.filter((d: any) => d.status === 'PENDING_LEADER' || d.status === 'PENDING_MANAGER');
      const approved = data.filter((d: any) => d.status === 'APPROVED');

      if (pending.length > 0) {
        kpis.push({
          label: 'Férias Pendentes',
          value: pending.length,
          icon: '🏖️',
        });
      }

      if (approved.length > 0) {
        kpis.push({
          label: 'Férias Aprovadas (próximas)',
          value: approved.length,
          icon: '✅',
        });
      }
    }
  } catch {
    // tabela pode não existir
  }

  return kpis;
}

async function fetchReimbursementKPIs(
  userId: string,
  accessibleIds: string[] | null
): Promise<IADashboardKPI[]> {
  const kpis: IADashboardKPI[] = [];

  try {
    let query = supabaseAdmin
      .from('Reimbursement')
      .select('status, valorTotal, email');

    if (accessibleIds && accessibleIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users_unified')
        .select('email')
        .in('id', accessibleIds);
      
      const emails = users?.map(u => u.email).filter(Boolean) || [];
      if (emails.length > 0) {
        query = query.in('email', emails);
      }
    }

    const { data } = await query
      .order('data', { ascending: false })
      .limit(30);

    if (data && data.length > 0) {
      const pending = data.filter((d: any) => d.status === 'pendente');
      if (pending.length > 0) {
        const total = pending.reduce((s: number, d: any) => s + (parseFloat(d.valorTotal) || 0), 0);
        kpis.push({
          label: 'Reembolsos Pendentes',
          value: `${pending.length} (R$ ${Math.round(total).toLocaleString('pt-BR')})`,
          icon: '💰',
        });
      }
    }
  } catch (err) {
    // tabela pode nao existir
  }

  return kpis;
}

/**
 * Busca KPIs modulares definidos na tabela kpi_targets
 */
async function fetchModularKPIs(userId: string, role: string): Promise<IADashboardKPI[]> {
  const kpis: IADashboardKPI[] = [];

  try {
    // 1. Buscar metas ativas
    const { data: targets } = await supabaseAdmin
      .from('kpi_targets')
      .select('*')
      .eq('active', true);

    if (!targets || targets.length === 0) return [];

    for (const target of targets) {
      const { data: recentLog } = await supabaseAdmin
        .from('agent_action_log')
        .select('metadata')
        .eq('action_type', 'kpi_analysis')
        .contains('metadata', { kpi_label: target.label })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentValue = recentLog?.metadata?.current_value || 0;
      const progress = target.target_value > 0 ? (currentValue / target.target_value) * 100 : 0;

      kpis.push({
        label: target.label,
        value: currentValue,
        target: target.target_value,
        unit: target.unit || '',
        icon: target.category === 'solutions' ? '✅' : '📈',
        trend: progress >= 100 ? 'up' : 'stable',
        change: progress > 0 ? Math.round(progress) : undefined
      });
    }
  } catch (err) {
    console.error('[IA Dashboard] Error fetching modular KPIs:', err);
  }

  return kpis;
}

/**
 * Exporta dados de KPI para XLSX (Buffer)
 */
export async function exportKPIsToXLSX(data: any): Promise<Buffer> {
  try {
    const { generateExcelReport } = await import('./excel-generator');
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.kpis)
          ? data.kpis
          : [data].filter(Boolean);

    const sample = (rows[0] && typeof rows[0] === 'object' ? rows[0] : { info: 'sem dados' }) as Record<string, any>;
    const keys = Object.keys(sample).length ? Object.keys(sample) : ['info'];
    const columns = keys.map((k) => ({ key: k, header: k, width: 18 }));
    return generateExcelReport(rows.length ? rows : [{ info: 'sem dados' }], columns, {
      titulo: data?.titulo || 'KPIs Portal ABZ',
      subtitulo: data?.subtitulo,
    });
  } catch (err) {
    console.error('[IA Dashboard] exportKPIsToXLSX failed:', err);
    return Buffer.from(JSON.stringify({ error: 'export_failed', message: String(err) }));
  }
}

/**
 * Exporta relatório de KPI para PDF (Buffer)
 */
export async function exportKPIsToPDF(data: any): Promise<Buffer> {
  try {
    const { generatePDFBase64 } = await import('./pdf-generator');
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.kpis)
          ? data.kpis
          : [];
    const base64 = generatePDFBase64(rows.length ? rows : [{ info: 'sem dados' }], 'kpis', {
      titulo: data?.titulo || 'Relatório KPI',
      subtitulo: data?.subtitulo,
    });
    return Buffer.from(base64, 'base64');
  } catch (err) {
    console.error('[IA Dashboard] exportKPIsToPDF failed:', err);
    return Buffer.from(JSON.stringify({ error: 'export_failed', message: String(err) }));
  }
}

// =====================================================
// Pendências (Pessoais + Fila de Aprovação)
// =====================================================

async function fetchPendencies(
  userId: string,
  role: IAUserRole,
  accessibleIds: string[] | null
): Promise<IADashboardPendency[]> {
  const pendencies: IADashboardPendency[] = [];

  // Obter email do usuario para queries de reembolso e Graph
  let userEmail = '';
  try {
    const { data: profile } = await supabaseAdmin
      .from('users_unified')
      .select('email')
      .eq('id', userId)
      .single();
    userEmail = profile?.email || '';
  } catch {}

  // =====================================================
  // 1. PENDENCIAS PESSOAIS (válido para TODOS os roles)
  // =====================================================

  // 1a. Avaliações pessoais pendentes
  try {
    const { data } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('id, colaborador_id, status, periodo_id, created_at')
      .eq('colaborador_id', userId)
      .in('status', ['pending', 'em_andamento', 'pendente', 'pendente_autoavaliacao'])
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      for (const item of data) {
        pendencies.push({
          id: item.id,
          title: 'Sua Avaliação Pendente',
          description: `Avaliação de desempenho aguardando sua ação (período: ${item.periodo_id || 'N/A'})`,
          priority: 'high',
          module: 'Avaliação',
        });
      }
    }
  } catch (err) { console.error('[IA Dashboard] Erro ao buscar avaliações pessoais:', err); }

  // 1b. Férias pessoais pendentes
  try {
    const { data } = await supabaseAdmin
      .from('leave_requests')
      .select('id, start_date, end_date, status, reason')
      .eq('user_id', userId)
      .in('status', ['PENDING_LEADER', 'PENDING_MANAGER', 'PENDING'])
      .order('start_date', { ascending: true })
      .limit(5);

    if (data) {
      for (const item of data) {
        pendencies.push({
          id: item.id,
          title: 'Suas Férias Pendentes',
          description: `${item.start_date} a ${item.end_date} — aguardando aprovação`,
          priority: 'medium',
          deadline: item.start_date,
          module: 'Férias',
        });
      }
    }
  } catch (err) { console.error('[IA Dashboard] Erro ao buscar férias pessoais:', err); }

  // 1c. Reembolsos pessoais pendentes
  if (userEmail) {
    try {
      const { data } = await supabaseAdmin
        .from('Reimbursement')
        .select('id, status, valorTotal, descricao, data')
        .eq('email', userEmail)
        .eq('status', 'pendente')
        .order('data', { ascending: true })
        .limit(5);

      if (data) {
        for (const item of data) {
          pendencies.push({
            id: item.id,
            title: 'Seu Reembolso Pendente',
            description: `R$ ${(parseFloat(item.valorTotal) || 0).toLocaleString('pt-BR')} — ${item.descricao || 'Sem descrição'}`,
            priority: 'medium',
            module: 'Reembolso',
          });
        }
      }
    } catch (err) { console.error('[IA Dashboard] Erro ao buscar reembolsos pessoais:', err); }
  }

  // 1d. EPIs vencidos pessoais
  try {
    const { data } = await supabaseAdmin
      .from('epi_records')
      .select('id, epi_name, status, expiry_date')
      .eq('user_id', userId)
      .in('status', ['expired', 'vencido'])
      .order('expiry_date', { ascending: true })
      .limit(5);

    if (data && data.length > 0) {
      for (const item of data) {
        pendencies.push({
          id: item.id,
          title: 'EPI Vencido',
          description: `${(item as any).epi_name || 'Equipamento'} venceu em ${(item as any).expiry_date || 'data desconhecida'}`,
          priority: 'high',
          module: 'EPI',
        });
      }
    }
  } catch { /* tabela ou campo pode nao existir */ }

  // 1e. Emails nao lidos (via Microsoft Graph, se configurado)
  try {
    const { msGraphClient } = await import('./microsoft/client');
    if (userEmail) {
      const emails = await msGraphClient.listEmails(userEmail, 10);
      const unread = emails.filter((e: any) => !e.isRead);
      if (unread.length > 0) {
        pendencies.push({
          id: `email_unread_${userId}`,
          title: 'E-mails Não Lidos',
          description: `Você tem ${unread.length} e-mail(s) não lido(s) na caixa de entrada`,
          priority: unread.length > 5 ? 'high' : 'medium',
          module: 'Email',
        });
      }
    }
  } catch { /* Graph pode nao estar configurado */ }

  // 1f. Eventos próximos (hoje/amanhã)
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { data: eventos } = await supabaseAdmin
      .from('calendar_events')
      .select('id, summary, start_time')
      .eq('user_id', userId)
      .gte('start_time', `${hoje}T00:00:00`)
      .lte('start_time', `${amanha}T23:59:59`)
      .order('start_time', { ascending: true })
      .limit(5);

    if (eventos && eventos.length > 0) {
      for (const ev of eventos) {
        pendencies.push({
          id: ev.id,
          title: 'Evento Hoje/Amanhã',
          description: `${ev.summary} — ${new Date(ev.start_time).toLocaleString('pt-BR')}`,
          priority: 'low',
          deadline: ev.start_time,
          module: 'Calendário',
        });
      }
    }
  } catch { /* tabela pode nao existir */ }

  // =====================================================
  // 2. FILA DE APROVAÇÃO (apenas ADMIN/GERENTE)
  // =====================================================

  if (role !== 'USER') {
    // 2a. Férias aguardando aprovação
    try {
      let query = supabaseAdmin
        .from('leave_requests')
        .select('id, user_id, start_date, end_date, status')
        .in('status', ['PENDING_LEADER', 'PENDING_MANAGER'])
        .order('start_date', { ascending: true });

      if (role === 'GERENTE' && accessibleIds) {
        query = query.in('user_id', accessibleIds);
      }

      const { data } = await query.limit(10);

      if (data) {
        for (const item of data) {
          if (item.user_id === userId) continue; // ja incluido nas pessoais
          pendencies.push({
            id: item.id,
            title: 'Aprovar Férias',
            description: `Férias de colaborador aguardando aprovação (${item.start_date} a ${item.end_date})`,
            priority: 'medium',
            deadline: item.start_date,
            module: 'Férias',
          });
        }
      }
    } catch (err) { console.error('[IA Dashboard] Erro ao buscar aprovações de férias:', err); }

    // 2b. Reembolsos aguardando aprovação
    try {
      let reimbQuery = supabaseAdmin
        .from('Reimbursement')
        .select('id, status, valorTotal, data, email')
        .eq('status', 'pendente')
        .order('data', { ascending: true });

      if (role === 'GERENTE' && accessibleIds) {
        const { data: teamUsers } = await supabaseAdmin
          .from('users_unified')
          .select('email')
          .in('id', accessibleIds);
        const teamEmails = teamUsers?.map(u => u.email).filter(Boolean) || [];
        if (teamEmails.length > 0) {
          reimbQuery = reimbQuery.in('email', teamEmails);
        }
      }

      const { data } = await reimbQuery.limit(10);

      if (data) {
        for (const item of data) {
          if (item.email === userEmail) continue; // ja incluido nas pessoais
          pendencies.push({
            id: item.id,
            title: 'Aprovar Reembolso',
            description: `R$ ${(parseFloat(item.valorTotal) || 0).toLocaleString('pt-BR')} aguardando aprovação`,
            priority: 'medium',
            module: 'Reembolso',
          });
        }
      }
    } catch (err) { console.error('[IA Dashboard] Erro ao buscar aprovações de reembolso:', err); }
  }

  return pendencies;
}

// =====================================================
// Resumo
// =====================================================

function buildSummary(
  userName: string,
  role: IAUserRole,
  kpis: IADashboardKPI[],
  pendencies: IADashboardPendency[]
): IADashboardSummary {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour < 12) greeting = `Bom dia, ${userName}! ☀️`;
  else if (hour < 18) greeting = `Boa tarde, ${userName}! 🌤️`;
  else greeting = `Boa noite, ${userName}! 🌙`;

  const highlights: string[] = [];

  const personalPendencies = pendencies.filter(p =>
    p.title?.startsWith('Sua ') || p.title?.startsWith('Seu ') ||
    p.title?.startsWith('EPI ') || p.title?.startsWith('E-mails ') ||
    p.title?.startsWith('Evento ')
  );
  const approvalPendencies = pendencies.filter(p => !personalPendencies.includes(p));

  if (personalPendencies.length > 0) {
    highlights.push(`Você tem **${personalPendencies.length}** pendência(s) pessoal(is) para resolver`);
  }

  if (approvalPendencies.length > 0) {
    highlights.push(`📋 **${approvalPendencies.length}** item(ns) aguardando sua aprovação`);
  }

  const highPriority = pendencies.filter(p => p.priority === 'high');
  if (highPriority.length > 0) {
    highlights.push(`⚠️ **${highPriority.length}** item(ns) de alta prioridade`);
  }

  if (pendencies.length === 0) {
    highlights.push('Nenhuma pendência pessoal ou aprovação pendente encontrada');
  }

  if (role === 'GERENTE') {
    highlights.push('Acesse o chat IA para consultar dados da sua equipe');
  } else if (role === 'ADMIN') {
    highlights.push('Painel completo — todos os departamentos disponíveis');
  }

  const quickStats = kpis.slice(0, 4);

  return { greeting, highlights, quickStats };
}

// =====================================================
// API principal
// =====================================================

/**
 * Gerar dados completos do dashboard para um usuário
 */
export async function generateDashboard(
  userId: string,
  baseRole: string,
  forceRefresh = false
): Promise<{ data: IADashboardData; cached: boolean }> {
  // Verificar cache
  if (!forceRefresh) {
    const cached = await getCachedDashboard(userId);
    if (cached) {
      return { data: cached, cached: true };
    }
  }

  // Buscar perfil para nome
  const { data: profile } = await supabaseAdmin
    .from('users_unified')
    .select('first_name, last_name')
    .eq('id', userId)
    .single();

  const userName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : 'Usuário';

  const role = await getEffectiveRole(userId, baseRole);
  const accessibleIds = await getAccessibleUserIds(userId, role);

  // Buscar dados em paralelo
  const [evalKPIs, vacKPIs, reimbKPIs, modularKPIs, pendencies] = await Promise.all([
    fetchEvaluationKPIs(userId, role, accessibleIds),
    fetchVacationKPIs(userId, accessibleIds),
    fetchReimbursementKPIs(userId, accessibleIds),
    fetchModularKPIs(userId, role),
    fetchPendencies(userId, role, accessibleIds),
  ]);

  const allKPIs = [...evalKPIs, ...vacKPIs, ...reimbKPIs, ...modularKPIs];
  const summary = buildSummary(userName, role, allKPIs, pendencies);

  const dashboardData: IADashboardData = {
    summary,
    kpis: allKPIs,
    pendencies,
    generatedAt: new Date().toISOString(),
  };

  // Cachear resultado
  await cacheDashboard(userId, dashboardData);

  return { data: dashboardData, cached: false };
}

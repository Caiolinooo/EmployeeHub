import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email-exchange';
import { gerarRelatorioEscalaMensal } from '@/lib/gestao-tripulantes/relatorio-escala-generator';
import {
  clientIpFromRequest,
  resolveAuthUserId,
} from '@/lib/gestao-tripulantes/aso-agendamento-auth';
import {
  avaliarAssinaturasFechamento,
  autorizacaoAssinarFechamento,
  mensagemErroAssinaturaAusente,
  mesclarAssinaturaFechamento,
  montarHashFechamento,
  normalizeAprovadoresObrigatorios,
  type AssinaturaFechamento,
} from '@/lib/gestao-tripulantes/fechamento-assinatura';
import { loadFechamentoAtor } from '@/lib/gestao-tripulantes/fechamento-gestores';

export const dynamic = 'force-dynamic';

function parseConfigValor(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token = extractTokenFromHeader(authHeader) || request.cookies.get('abzToken')?.value || request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { mesAno, observacoes, enviarEmail = true, filtros = {} } = body as {
      mesAno?: string;
      observacoes?: string;
      enviarEmail?: boolean;
      filtros?: Record<string, string | undefined>;
      signature_url?: string;
      assinatura_url?: string;
    };
    if (!mesAno) {
      return NextResponse.json({ error: 'Mês de referência (mesAno) é obrigatório (formato YYYY-MM)' }, { status: 400 });
    }

    const userId = resolveAuthUserId(payload);
    if (!userId) {
      return NextResponse.json({ error: 'Não foi possível identificar o usuário autenticado.' }, { status: 401 });
    }

    const { data: configData } = await supabaseAdmin
      .from('gt_configuracoes')
      .select('valor')
      .eq('chave', 'gt_fechamento_mensal_config')
      .maybeSingle();

    const config = parseConfigValor(configData?.valor);
    const aprovadoresObrigatorios = normalizeAprovadoresObrigatorios(config.aprovadores_obrigatorios);

    const ator = await loadFechamentoAtor(userId);
    const gate = autorizacaoAssinarFechamento({
      obrigatorios: aprovadoresObrigatorios,
      userId,
      email: ator?.email || payload.email || '',
      role: ator?.role || payload.role,
    });
    if (!gate.permitido) {
      return NextResponse.json({ error: gate.motivo }, { status: 403 });
    }
    const approverName = ator?.nome || payload.email || 'Aprovador';
    const approverEmail = (ator?.email || payload.email || '').toLowerCase().trim();
    const approverCpf = ator?.cpf || '';
    const approverRole = ator?.role || payload.role || '';
    const signatureFromBody = String(body.signature_url || body.assinatura_url || '').trim();
    const approverSignatureUrl = signatureFromBody || ator?.signatureUrl || '';

    if (!approverSignatureUrl) {
      return NextResponse.json({ error: mensagemErroAssinaturaAusente() }, { status: 400 });
    }
    if (!approverEmail) {
      return NextResponse.json({ error: 'Seu usuário não tem e-mail cadastrado. Atualize o perfil antes de assinar o fechamento.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const clientIp = clientIpFromRequest(request);
    const hashContent = montarHashFechamento({
      mesAno,
      nome: approverName,
      cpf: approverCpf,
      dataIso: nowIso,
      ip: clientIp,
    });
    const signatureHash = crypto.createHash('sha256').update(hashContent).digest('hex');

    const currentSignature: AssinaturaFechamento = {
      userId,
      email: approverEmail,
      nome: approverName,
      cpf: approverCpf,
      cargo: ator?.cargo || approverRole || 'Aprovador',
      role: approverRole,
      assinado_em: nowIso,
      dataHora: new Date().toLocaleString('pt-BR'),
      ip: clientIp,
      assinaturaUrl: approverSignatureUrl,
      assinaturaHash: signatureHash,
    };

    const { data: registroExistente } = await supabaseAdmin
      .from('gt_relatorios_aprovacoes')
      .select('*')
      .eq('mes_referencia', mesAno)
      .maybeSingle();

    const existentes = Array.isArray(registroExistente?.assinaturas)
      ? (registroExistente.assinaturas as AssinaturaFechamento[])
      : [];
    const assinaturasArray = mesclarAssinaturaFechamento(existentes, currentSignature);

    const { todosAssinaram, pendentes } = avaliarAssinaturasFechamento(
      aprovadoresObrigatorios,
      assinaturasArray,
    );

    const reportResult = await gerarRelatorioEscalaMensal({
      mesAno,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
      empresa: filtros.empresa,
      embarcacao: filtros.embarcacao,
      cargo: filtros.cargo,
      statusAtivo: filtros.statusAtivo as 'ativos' | 'inativos' | 'todos' | undefined,
      busca: filtros.busca,
      aprovadores: assinaturasArray.map((s) => ({
        nome: s.nome || '',
        cpf: s.cpf,
        email: s.email,
        cargo: s.cargo,
        dataHora: s.dataHora || s.assinado_em || '',
        ip: s.ip,
        assinaturaUrl: s.assinaturaUrl,
        assinaturaHash: s.assinaturaHash,
      })),
    });

    const recipientRaw = config.emails_destinatarios_dp;
    const recipientList = Array.isArray(recipientRaw)
      ? recipientRaw.map((e) => String(e).trim()).filter(Boolean)
      : ['dp@groupabz.com'];
    const safeEmb = (filtros.embarcacao || 'Todas').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const filename = `relatorio_fechamento_${mesAno}_${safeEmb}.xlsx`;
    let emailSent = false;
    let emailErrorMsg: string | null = null;

    if (todosAssinaram && enviarEmail && recipientList.length > 0) {
      const subject = String(config.assunto_email_template || 'Fechamento de Escala Gestão de Tripulantes - {Mes_Ano}')
        .replace(/{Mes_Ano}/g, mesAno);

      const chancelasHtml = assinaturasArray.map((s) => `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px 12px; border-radius: 6px; margin-top: 8px;">
          <p style="margin: 0; font-size: 12px; color: #065f46;">
            <strong>✓ Assinado por:</strong> ${s.nome} (${s.cargo || 'Gestor'})<br />
            <strong>Data/Hora:</strong> ${s.dataHora} | <strong>IP:</strong> ${s.ip}<br />
            <strong>Hash de Integridade:</strong> <code style="font-size: 11px;">${s.assinaturaHash}</code>
          </p>
        </div>
      `).join('');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 680px;">
          <div style="background-color: #002060; padding: 18px 24px; border-radius: 8px 8px 0 0; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px;">ABZ Group — Gestão de Tripulantes</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Relatório Oficial de Fechamento de Escalas — ${mesAno}</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; background-color: #ffffff; border-radius: 0 0 8px 8px;">
            <p>Prezados,</p>
            <p>Segue em anexo a planilha oficial consolidada de fechamento de escalas da Gestão de Tripulantes referente ao período de <strong>${mesAno}</strong>.</p>
            
            <div style="background-color: #f8fafc; border-left: 4px solid #002060; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
              <h4 style="margin: 0 0 8px 0; color: #002060;">Resumo Consolidado:</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
                <li><strong>Total de Colaboradores:</strong> ${reportResult.totaisConsolidados.totalColaboradores}</li>
                <li><strong>ON (A bordo):</strong> ${reportResult.totaisConsolidados.totalON} dias</li>
                <li><strong>DBA (Dobra):</strong> ${reportResult.totaisConsolidados.totalDBA} dias</li>
                <li><strong>FI (Folga Indenizada):</strong> ${reportResult.totaisConsolidados.totalFI} dias</li>
                <li><strong>Folga:</strong> ${reportResult.totaisConsolidados.totalFOLGA} dias</li>
                <li><strong>STB (StandBy):</strong> ${reportResult.totaisConsolidados.totalSTB} dias</li>
                <li><strong>TRE (Treinamento):</strong> ${reportResult.totaisConsolidados.totalTRE} dias</li>
                <li><strong>FER (Férias):</strong> ${reportResult.totaisConsolidados.totalFER} dias</li>
                <li><strong>Alertas de escala/soma:</strong> ${reportResult.totaisConsolidados.colaboradoresComAlerta}</li>
              </ul>
            </div>

            <h4 style="margin: 16px 0 4px 0; color: #002060;">Aprovações e Assinaturas Digitais Registradas:</h4>
            ${chancelasHtml}

            <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
              Este documento foi gerado e aprovado com validação de chaves criptográficas no sistema corporativo EmployeeHub ABZ Group.
            </p>
          </div>
        </div>
      `;

      try {
        await sendEmail(
          recipientList.join(','),
          subject,
          `Relatório de Fechamento de Escalas ${mesAno} aprovado.`,
          htmlBody,
          {
            attachments: [
              {
                filename,
                content: reportResult.buffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            ],
          },
        );
        emailSent = true;
      } catch (err) {
        console.error('[API Aprovar SendEmail Error]', err);
        emailErrorMsg = err instanceof Error ? err.message : 'Falha ao despachar e-mail para destinatários';
      }
    }

    const [ano, mes] = mesAno.split('-').map(Number);
    const finalStatus = todosAssinaram
      ? (emailSent ? 'enviado' : 'aprovado')
      : 'em_aprovacao';

    const { data: record, error: dbError } = await supabaseAdmin
      .from('gt_relatorios_aprovacoes')
      .upsert({
        mes_referencia: mesAno,
        ano,
        mes,
        status: finalStatus,
        dados_totais: reportResult.totaisConsolidados,
        total_colaboradores: reportResult.totaisConsolidados.totalColaboradores,
        total_on: reportResult.totaisConsolidados.totalON,
        total_dba: reportResult.totaisConsolidados.totalDBA,
        total_fi: reportResult.totaisConsolidados.totalFI,
        total_tre: reportResult.totaisConsolidados.totalTRE,
        aprovadores_obrigatorios: aprovadoresObrigatorios,
        assinaturas: assinaturasArray,
        aprovado_por_id: userId,
        aprovado_por_nome: approverName,
        aprovado_por_cpf: approverCpf,
        aprovado_em: nowIso,
        aprovado_ip: clientIp,
        assinatura_url: approverSignatureUrl,
        assinatura_hash: signatureHash,
        emails_enviados: emailSent ? recipientList : (registroExistente?.emails_enviados || []),
        enviado_em: emailSent ? nowIso : (registroExistente?.enviado_em || null),
        observacoes: observacoes || registroExistente?.observacoes || null,
        arquivo_nome: filename,
        updated_at: nowIso,
      }, { onConflict: 'mes_referencia' })
      .select()
      .single();

    if (dbError) {
      console.error('[API Aprovar Upsert DB Error]', dbError);
      return NextResponse.json(
        { error: dbError.message || 'Não foi possível gravar a aprovação do fechamento.' },
        { status: 500 },
      );
    }

    let message = '';
    if (todosAssinaram) {
      message = emailSent
        ? `Fechamento de ${mesAno} aprovado por todos os integrantes e enviado com sucesso ao DP (${recipientList.join(', ')})!`
        : `Fechamento de ${mesAno} aprovado por todos os integrantes!`;
      if (emailErrorMsg) {
        message += ` O e-mail ao DP não foi enviado: ${emailErrorMsg}`;
      }
    } else {
      const nomesPendentes = pendentes.map((p) => p.nome || p.email).join(', ');
      message = `Sua assinatura foi registrada com sucesso! Aguardando a assinatura de: ${nomesPendentes} para o envio final ao DP.`;
    }

    return NextResponse.json({
      success: true,
      message,
      status: finalStatus,
      registro: record,
      todosAssinaram,
      pendentes,
      assinaturas: assinaturasArray,
      emailSent,
      emailErrorMsg,
      signatureHash,
    });
  } catch (error) {
    console.error('[API Aprovar Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar aprovação do fechamento' },
      { status: 500 },
    );
  }
}

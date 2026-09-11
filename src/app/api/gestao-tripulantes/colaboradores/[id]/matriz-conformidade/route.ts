import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { agruparDocumentosPorTipo } from '@/lib/gestao-tripulantes/documento-historico';

export const dynamic = 'force-dynamic';

function normalizeCourseName(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || undefined;
    const token =
      extractTokenFromHeader(authHeader) ||
      request.cookies.get('abzToken')?.value ||
      request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Token de autorização necessário' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { id } = await context.params;

    // 1. Fetch collaborator with cargo
    const { data: colab, error: colErr } = await supabaseAdmin
      .from('gt_colaboradores')
      .select('id, nome_completo, cpf, cargo_id, regime_trabalho, gt_cargos(id, nome)')
      .eq('id', id)
      .maybeSingle();

    if (colErr || !colab) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    const rawCargoNome = (colab.gt_cargos as any)?.nome || '';
    const regime = colab.regime_trabalho || 'Offshore';

    // 2. Fetch requirements for this cargo across active matrices
    let reqQuery = supabaseAdmin
      .from('gt_matriz_treinamento_requisitos')
      .select('*, gt_matrizes_treinamento(codigo, nome, ativo)')
      .order('obrigatorio', { ascending: false })
      .order('treinamento_nome', { ascending: true });

    if (colab.cargo_id) {
      reqQuery = reqQuery.or(`cargo_id.eq.${colab.cargo_id},cargo_nome.ilike.%${rawCargoNome}%`);
    } else if (rawCargoNome) {
      reqQuery = reqQuery.ilike('cargo_nome', `%${rawCargoNome}%`);
    }

    const { data: allReqs, error: reqErr } = await reqQuery;

    if (reqErr) {
      console.error('Erro ao buscar requisitos da matriz:', reqErr);
    }

    // Filter to requirements from active matrices
    const activeReqs = (allReqs || []).filter((r: any) => {
      const matrizAtiva = r.gt_matrizes_treinamento ? r.gt_matrizes_treinamento.ativo : true;
      return matrizAtiva;
    });

    // 3. Fetch collaborator's training documents
    const { data: docs, error: docErr } = await supabaseAdmin
      .from('gt_documentos')
      .select('*, gt_documentos_treinamento(*)')
      .eq('colaborador_id', id)
      .eq('tipo_documento', 'treinamento')
      .is('deleted_at', null)
      .order('data_validade', { ascending: false, nullsFirst: false });

    if (docErr) {
      console.error('Erro ao buscar documentos do colaborador:', docErr);
    }

    // Group documents to find primary valid/most recent for each training type
    const grupos = agruparDocumentosPorTipo(docs || []);
    const primaryDocs = grupos.map(g => g.primary);

    // 4. Match requirements against collaborator's primary trainings
    const now = new Date();
    const requirementsStatus = activeReqs.map((req: any) => {
      const reqNorm = normalizeCourseName(req.treinamento_nome);
      const reqSigla = req.sigla ? normalizeCourseName(req.sigla) : '';

      // Find matching primary doc
      const matchedDoc = primaryDocs.find((doc: any) => {
        const titleNorm = normalizeCourseName(doc.titulo || '');
        const subtipoNorm = normalizeCourseName(doc.subtipo || '');
        const extraNameNorm = normalizeCourseName(doc.gt_documentos_treinamento?.nome_curso || '');

        if (titleNorm === reqNorm || extraNameNorm === reqNorm) return true;
        if (reqSigla && (subtipoNorm === reqSigla || titleNorm.includes(reqSigla))) return true;
        if (titleNorm.includes(reqNorm) || reqNorm.includes(titleNorm)) return true;

        // Common marine aliases
        if (reqNorm.includes('cbsp') || reqNorm.includes('curso basico de seguranca de plataforma')) {
          if (titleNorm.includes('cbsp') || titleNorm.includes('curso basico de seguranca') || subtipoNorm === 'cbsp') return true;
        }
        if (reqNorm.includes('huet') && (titleNorm.includes('huet') || subtipoNorm.includes('huet'))) return true;
        if (reqNorm.includes('ca ebs') && (titleNorm.includes('ca ebs') || titleNorm.includes('ca-ebs') || subtipoNorm.includes('ebs'))) return true;
        if (reqNorm.includes('boas praticas') && (titleNorm.includes('boas praticas') || titleNorm.includes('boas práticas'))) return true;

        return false;
      });

      let status = 'nao_realizado';
      let diasRestantes: number | null = null;

      if (matchedDoc) {
        if (!matchedDoc.data_validade) {
          status = 'conforme'; // permanente
        } else {
          const valDate = new Date(`${matchedDoc.data_validade.split('T')[0]}T00:00:00`);
          diasRestantes = Math.ceil((valDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diasRestantes < 0) {
            status = 'vencido';
          } else if (diasRestantes <= 30) {
            status = 'vencendo';
          } else {
            status = 'conforme';
          }
        }
      }

      return {
        requisito_id: req.id,
        treinamento_nome: req.treinamento_nome,
        sigla: req.sigla,
        obrigatorio: req.obrigatorio,
        cargo_nome: req.cargo_nome,
        regime: req.regime,
        matriz_nome: req.gt_matrizes_treinamento?.nome || 'Matriz Geral',
        status, // conforme | vencendo | vencido | nao_realizado
        dias_restantes: diasRestantes,
        documento_id: matchedDoc?.id || null,
        data_emissao: matchedDoc?.data_emissao || null,
        data_validade: matchedDoc?.data_validade || null,
        arquivo_url: matchedDoc?.arquivo_url || null,
        numero_documento: matchedDoc?.numero_documento || null,
      };
    });

    const totalRequisitos = requirementsStatus.length;
    const totalConforme = requirementsStatus.filter(r => r.status === 'conforme').length;
    const totalVencendo = requirementsStatus.filter(r => r.status === 'vencendo').length;
    const totalVencido = requirementsStatus.filter(r => r.status === 'vencido').length;
    const totalFaltante = requirementsStatus.filter(r => r.status === 'nao_realizado').length;

    const percentualConformidade = totalRequisitos > 0
      ? Math.round((totalConforme / totalRequisitos) * 100)
      : 100;

    return NextResponse.json({
      success: true,
      data: {
        colaborador_id: id,
        cargo_nome: rawCargoNome || 'Sem Cargo Definido',
        regime,
        total_requisitos: totalRequisitos,
        total_conforme: totalConforme,
        total_vencendo: totalVencendo,
        total_vencido: totalVencido,
        total_faltante: totalFaltante,
        percentual_conformidade: percentualConformidade,
        requisitos: requirementsStatus,
      },
    });
  } catch (error) {
    console.error('Erro ao calcular conformidade da matriz:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

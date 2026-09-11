import fs from 'fs';
import { supabaseAdmin } from '@/lib/supabase';
import type { GTColaborador, TipoDocumento, TipoExameASO } from '@/types/gestao-tripulantes';
import type { MIOIntegrante, MIOTreinamento, MIOEmbarque } from '@/types/mio';
import { mioClient } from '@/lib/mio/client';
import { runMioPull } from '@/lib/mio/pull-context';
import { v4 as uuidv4 } from 'uuid';
import { sendEmailVerificationLink } from '@/lib/email-verification';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import { garantirNumeroRastreioUnico } from '@/lib/gestao-tripulantes/documento-integrity';
import {
  baixarAnexoMioParaLocal,
  hasMioAnexoFlag,
  registrarAnexoMiss,
  marcarAnexoMissResolvido,
  collectMioAnexoUrls,
} from '@/lib/gestao-tripulantes/mio-file-copy';
import {
  detectRotationType,
  lgpRotationEnd,
  lgpRotationStart,
  type RawLGPRecord,
} from '@/lib/gestao-tripulantes/lgp-rotation';
import { dataLocalISO } from '@/lib/gestao-tripulantes/aso-vencimentos';
import { composeLgpObservacoes } from '@/lib/gestao-tripulantes/embarque-status';
import {
  mesclarRegimeMio,
  regimeFromMioIntegrante,
} from '@/lib/gestao-tripulantes/regime-escala';

interface MIOConfig {
  baseUrl: string;
  token: string;
  escritaHabilitada: boolean;
}

/** Unbuffered pull progress (Node buffers console.log when stdout is captured). */
function pullLog(msg: string): void {
  try {
    fs.writeSync(1, `${msg}\n`);
  } catch {
    console.log(msg);
  }
}

interface MIOApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getMIOConfig(): Promise<MIOConfig | null> {
  try {
    const supabase = supabaseAdmin;
    const { data: configRow } = await supabase
      .from('gt_configuracoes')
      .select('valor')
      .eq('chave', 'mio_integracao')
      .maybeSingle();

    if (!configRow?.valor) return null;

    const config = configRow.valor as Record<string, any>;

    return {
      baseUrl: (config.base_url as string) || '',
      token: (config.token as string) || '',
      escritaHabilitada:
        config.escrita_habilitada === true ||
        config.escrita_habilitada === 'true',
    };
  } catch (error) {
    console.error('Erro ao buscar configurações MIO:', error);
    return null;
  }
}



function mapMIOToColaborador(mio: MIOIntegrante): Partial<GTColaborador> {
  return {
    nome_completo: mio.nome,
    cpf: mio.cpf?.replace(/\D/g, ''),
    email: mio.email || undefined,
    telefone: mio.celular || mio.telefone || undefined,
    data_nascimento: cleanDate(mio.data_nascimento) || undefined,
    nome_mae: mio.nome_mae || undefined,
    nome_pai: mio.nome_pai || undefined,
    matricula: mio.matricula || undefined,
    data_admissao: cleanDate(mio.data_admissao) || undefined,
    data_demissao: cleanDate(mio.data_demissao) || undefined,
    dados_bancarios: mio.dados_bancarios || undefined,
    origem: 'mio',
    mio_id: mio.id ? String(mio.id) : undefined,
    ativo: isMioIntegranteAtivo(mio),
    ultimo_sync_mio: new Date().toISOString(),
  };
}

/** Persist inactive/demitted people; only Desligado/Inativo/etc. flip ativo=false. */
export function isMioIntegranteAtivo(mio: Pick<MIOIntegrante, 'situacao' | 'data_demissao'>): boolean {
  const raw = (mio.situacao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (mio.data_demissao && String(mio.data_demissao).trim() && String(mio.data_demissao) !== '0000-00-00') {
    if (!raw || raw.includes('deslig') || raw.includes('demit') || raw.includes('inativ') || raw.includes('arquiv')) {
      return false;
    }
  }
  if (!raw) return true;
  if (['desligado', 'demitido', 'inativo', 'inativa', 'arquivado', 'arquivada', 'cancelado', 'excluido'].some((s) => raw.includes(s))) {
    return false;
  }
  return true;
}

function isAsoLikeTreinamento(tre: MIOTreinamento): boolean {
  const blob = `${tre.tipo_documento || ''} ${tre.nome_curso || ''} ${tre.area || ''}`.toLowerCase();
  return /\baso\b|atestado de saude|atestado de saúde|exame ocupacional/.test(blob);
}

function mapTipoExameAso(tre: MIOTreinamento): TipoExameASO {
  const blob = `${tre.nome_curso || ''} ${tre.tipo_documento || ''}`.toLowerCase();
  if (blob.includes('admiss')) return 'admissional';
  if (blob.includes('demiss')) return 'demissional';
  if (blob.includes('retorno')) return 'retorno';
  if (blob.includes('mudanca') || blob.includes('mudança') || blob.includes('funcao') || blob.includes('função')) {
    return 'mudanca_funcao';
  }
  return 'periodico';
}

function cleanDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = dateStr.trim();
  if (d === '0000-00-00' || d === '0000-00-00 00:00:00' || d === '') return null;
  return d;
}

function getStatusValidacao(dataValidade: string | null | undefined, tipo?: string): string {
  if (!dataValidade) {
    if (tipo === 'treinamento') return 'valido';
    return 'pendente';
  }
  const validade = new Date(dataValidade);
  const agora = new Date();
  const diffDias = Math.ceil((validade.getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return 'vencido';
  if (diffDias <= 30) return 'vencendo';
  return 'valido';
}

async function anexarArquivoMioSeHouver(opts: {
  colaboradorId: string;
  documentoId: string;
  origemRef: string;
  treinamentoId?: string;
  anexoUrl?: string | null;
  contemAnexo?: unknown;
  record?: Record<string, unknown>;
}): Promise<'copied' | 'already_local' | 'missing' | 'skipped'> {
  const extraUrls = collectMioAnexoUrls(opts.record);
  const hasUrl = Boolean(opts.anexoUrl) || extraUrls.length > 0;
  const hasFlag = hasMioAnexoFlag(opts.contemAnexo);
  // Don't fire 6 binary GETs when MIO itself says there is no attachment.
  if (!hasUrl && !hasFlag) {
    await supabaseAdmin
      .from('gt_documentos')
      .update({
        arquivo_ausente: true,
        arquivo_ausente_motivo: `mio_id=${opts.treinamentoId || opts.origemRef}; no URL and Contém Anexo? is not yes`,
        arquivo_ausente_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.documentoId);
    await registrarAnexoMiss({
      origemRef: opts.origemRef,
      mioId: opts.treinamentoId,
      colaboradorId: opts.colaboradorId,
      motivo: 'no_url_and_no_anexo_flag',
    });
    return 'skipped';
  }
  try {
    const copied = await baixarAnexoMioParaLocal({
      colaboradorId: opts.colaboradorId,
      origemRef: opts.origemRef,
      treinamentoId: opts.treinamentoId,
      anexoUrl: opts.anexoUrl,
      extraUrls,
      record: opts.record,
    });
    if (!copied) {
      await supabaseAdmin
        .from('gt_documentos')
        .update({
          arquivo_ausente: true,
          arquivo_ausente_motivo: `mio_id=${opts.treinamentoId || opts.origemRef}; no downloadable bytes`,
          arquivo_ausente_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', opts.documentoId);
      await registrarAnexoMiss({
        origemRef: opts.origemRef,
        mioId: opts.treinamentoId,
        colaboradorId: opts.colaboradorId,
        motivo: `no bytes for ${opts.origemRef} (urls=${extraUrls.length}, flag=${hasMioAnexoFlag(opts.contemAnexo)})`,
      });
      return 'missing';
    }
    const { data: current } = await supabaseAdmin
      .from('gt_documentos')
      .select('arquivo_path, arquivo_url, arquivo_hash')
      .eq('id', opts.documentoId)
      .maybeSingle();
    const alreadyLocal =
      Boolean(current?.arquivo_path) &&
      Boolean(current?.arquivo_url) &&
      !/mio\.app\.br/i.test(current?.arquivo_url || '');
    if (alreadyLocal && current?.arquivo_hash === copied.arquivo_hash) {
      await supabaseAdmin
        .from('gt_documentos')
        .update({ arquivo_ausente: false, arquivo_ausente_motivo: null, updated_at: new Date().toISOString() })
        .eq('id', opts.documentoId);
      await marcarAnexoMissResolvido(opts.origemRef);
      return 'already_local';
    }
    if (alreadyLocal && current?.arquivo_hash && current.arquivo_hash !== copied.arquivo_hash) {
      return 'already_local';
    }
    await supabaseAdmin
      .from('gt_documentos')
      .update({
        arquivo_path: copied.arquivo_path,
        arquivo_url: copied.arquivo_url,
        arquivo_hash: copied.arquivo_hash,
        arquivo_tamanho_bytes: copied.arquivo_tamanho_bytes,
        arquivo_tipo: copied.arquivo_tipo,
        arquivo_ausente: false,
        arquivo_ausente_motivo: null,
        arquivo_ausente_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.documentoId);
    await marcarAnexoMissResolvido(opts.origemRef);
    return 'copied';
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    console.warn(`[MIO pull] anexo skip ${opts.origemRef}:`, err);
    await registrarAnexoMiss({
      origemRef: opts.origemRef,
      mioId: opts.treinamentoId,
      colaboradorId: opts.colaboradorId,
      motivo,
    });
    return 'missing';
  }
}

function isLocalArquivoUrl(url?: string | null): boolean {
  return Boolean(url) && !/mio\.app\.br/i.test(url || '');
}

async function anexarDocumentoSePreciso(opts: {
  existing: { arquivo_path?: string | null; arquivo_url?: string | null; arquivo_ausente?: boolean | null } | null;
  colaboradorId: string;
  documentoId: string;
  origemRef: string;
  treinamentoId?: string;
  anexoUrl?: string | null;
  contemAnexo?: unknown;
  record?: Record<string, unknown>;
}): Promise<'copied' | 'already_local' | 'missing' | 'skipped'> {
  const extraUrls = collectMioAnexoUrls(opts.record);
  const hasUrl = Boolean(opts.anexoUrl) || extraUrls.length > 0;
  const hasFlag = hasMioAnexoFlag(opts.contemAnexo);
  if (opts.existing?.arquivo_path && isLocalArquivoUrl(opts.existing.arquivo_url)) {
    return 'already_local';
  }
  if (opts.existing?.arquivo_ausente && !hasUrl && !hasFlag) {
    return 'skipped';
  }
  return anexarArquivoMioSeHouver(opts);
}

async function upsertAsoChild(
  documentoId: string,
  colaboradorId: string,
  tre: MIOTreinamento,
  dataRealizacao: string | null
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('gt_documentos_aso')
    .select('id')
    .eq('documento_id', documentoId)
    .maybeSingle();
  const row = {
    documento_id: documentoId,
    colaborador_id: colaboradorId,
    tipo_exame: mapTipoExameAso(tre),
    data_realizacao: dataRealizacao || undefined,
  };
  if (existing) {
    await supabaseAdmin.from('gt_documentos_aso').update(row).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('gt_documentos_aso').insert({ ...row, esocial_status: 'nao_enviado' });
  }
}

export async function syncFromMIO(): Promise<{
  success: boolean;
  data?: { importados: number; atualizados: number; ignorados: number; inativados: number; erros: string[] };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin;
    const integrantes = await mioClient.getIntegrantes();

    if (!integrantes || integrantes.length === 0) {
      return { success: false, error: 'Nenhum integrante retornado do MIO' };
    }

    await persistMioCacheRow('integrantes', integrantes);

    const inativosMio = integrantes.filter((i) => !isMioIntegranteAtivo(i)).length;
    console.log(`[MIO pull] Integrantes: ${integrantes.length} (inativos/desligados no payload: ${inativosMio})`);

    let importados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    // Chaves naturais vistas nesta execução (para detectar ausentes do MIO).
    const vistosMioIds = new Set<string>();
    const vistosCpfs = new Set<string>();

    for (const integrante of integrantes) {
      try {
        // Borda: sem nome ou sem CPF → logar, pular e contabilizar.
        const nome = integrante.nome?.trim();
        const cpfLimpo = integrante.cpf?.replace(/\D/g, '');
        if (!nome || !cpfLimpo) {
          console.warn(`[MIO Sync] Integrante ignorado (sem nome/CPF): ${nome || 'Sem Nome'} (id ${integrante.id ?? '?'})`);
          ignorados++;
          continue;
        }
        if (integrante.id != null) vistosMioIds.add(String(integrante.id));
        vistosCpfs.add(cpfLimpo);

        // Upsert idempotente: localiza pela chave natural mio_id,
        // depois CPF digits-only, depois CPF legado mascarado.
        const mioIdStr = integrante.id != null ? String(integrante.id) : null;
        let existing: {
          id: string;
          regime_trabalho?: string | null;
          escala_embarque?: string | number | null;
          escala_folga?: string | number | null;
        } | null = null;

        if (mioIdStr) {
          const { data } = await supabase
            .from('gt_colaboradores')
            .select('id, regime_trabalho, escala_embarque, escala_folga')
            .eq('mio_id', mioIdStr)
            .is('deleted_at', null)
            .maybeSingle();
          existing = data ?? null;
        }

        if (!existing) {
          const byCpf = await findColaboradorByCpf(cpfLimpo);
          if (byCpf) {
            const { data } = await supabase
              .from('gt_colaboradores')
              .select('id, regime_trabalho, escala_embarque, escala_folga')
              .eq('id', byCpf.id)
              .maybeSingle();
            existing = data ?? { id: byCpf.id };
          }
        }

        const agoraIso = new Date().toISOString();
        const colaboradorData: Record<string, unknown> = { ...mapMIOToColaborador(integrante), updated_at: agoraIso };
        const regimeMio = mesclarRegimeMio(
          existing,
          regimeFromMioIntegrante(integrante as unknown as {
            [key: string]: unknown;
            regime_trabalho?: string | null;
            regime?: string | null;
            Regime?: string | null;
          }),
        );
        if (regimeMio) {
          colaboradorData.regime_trabalho = regimeMio.regime_trabalho;
          colaboradorData.escala_embarque = regimeMio.escala_embarque;
          colaboradorData.escala_folga = regimeMio.escala_folga;
        }

        if (existing) {
          // Nunca insert duplicado: sempre UPDATE na linha já existente.
          const { error: updateErr } = await supabase
            .from('gt_colaboradores')
            .update(colaboradorData)
            .eq('id', existing.id);

          if (updateErr) {
            erros.push(`Erro ao atualizar ${nome}: ${updateErr.message}`);
          } else {
            atualizados++;
          }
        } else {
          const { error: insertErr } = await supabase
            .from('gt_colaboradores')
            .insert(colaboradorData);

          if (insertErr) {
            erros.push(`Erro ao importar ${nome}: ${insertErr.message}`);
          } else {
            importados++;
          }
        }
      } catch (err) {
        erros.push(`Erro ao processar ${integrante.nome || 'Sem Nome'}: ${err}`);
      }
    }

    // Borda: integrante presente no portal mas ausente do MIO → marcar INATIVO (nunca deletar).
    let inativados = 0;
    const { data: portalMio, error: portalErr } = await supabase
      .from('gt_colaboradores')
      .select('id, mio_id, cpf')
      .eq('origem', 'mio')
      .is('deleted_at', null);

    if (portalErr) {
      erros.push(`Erro ao listar colaboradores origem='mio' para inativação: ${portalErr.message}`);
    } else {
      for (const col of portalMio || []) {
        const colCpfDigits = typeof col.cpf === 'string' ? col.cpf.replace(/\D/g, '') : '';
        const presente =
          (col.mio_id != null && vistosMioIds.has(String(col.mio_id))) ||
          (!!colCpfDigits && vistosCpfs.has(colCpfDigits));
        if (!presente) {
          const { error: inatErr } = await supabase
            .from('gt_colaboradores')
            .update({ ativo: false, updated_at: new Date().toISOString() })
            .eq('id', col.id);
          if (inatErr) {
            erros.push(`Erro ao marcar inativo ${col.mio_id || col.cpf || col.id}: ${inatErr.message}`);
          } else {
            inativados++;
          }
        }
      }
    }

    return {
      success: true,
      data: {
        importados,
        atualizados,
        ignorados,
        inativados,
        erros,
      },
    };
  } catch (error) {
    console.error('Erro em syncFromMIO:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function syncTreinamentosFromMIO(): Promise<{
  success: boolean;
  data?: { importados: number; atualizados: number; ignorados: number; erros: string[] };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin;
    let treinamentos = await mioClient.getAllTreinamentos();
    if (!treinamentos || treinamentos.length === 0) {
      const { data: cols } = await supabase
        .from('gt_colaboradores')
        .select('cpf')
        .is('deleted_at', null);
      const cpfs = (cols || []).map((c) => c.cpf).filter(Boolean) as string[];
      console.log(`[MIO pull] Falling back to per-CPF treinamentos (${cpfs.length} CPFs)`);
      treinamentos = await mioClient.getTreinamentosForCpfs(cpfs);
    }

    if (!treinamentos || treinamentos.length === 0) {
      return { success: false, error: 'Nenhum treinamento retornado do MIO' };
    }

    await persistMioCacheRow('treinamentos', treinamentos);

    const importados: string[] = [];
    const atualizados: string[] = [];
    const ignorados: string[] = [];
    const erros: string[] = [];

    let idx = 0;
    for (const tre of treinamentos) {
      idx++;
      if (idx === 1 || idx % 50 === 0 || idx === treinamentos.length) {
        pullLog(`[MIO pull] treinamentos persist ${idx}/${treinamentos.length}`);
      }
      try {
        const cpfLimpo = tre.cpf?.replace(/\D/g, '');
        if (!cpfLimpo) continue;

        const colaborador = await findColaboradorByCpf(cpfLimpo);

        if (!colaborador) {
          ignorados.push(`Colaborador não encontrado (ativo ou inativo): ${tre.nome} (${cpfLimpo})`);
          continue;
        }

        const asoLike = isAsoLikeTreinamento(tre);
        const tipoDocumento: TipoDocumento = asoLike ? 'aso' : 'treinamento';
        const docId = asoLike ? `mio_aso_${tre.id}` : `mio_treinamento_${tre.id}`;
        const dataValidade = cleanDate(tre.data_validade || tre.vencimento_em);
        const dataConclusao = cleanDate(tre.data_realizacao || tre.concluido_em);

        const { data: existingByNew } = await supabase
          .from('gt_documentos')
          .select('id, arquivo_path, arquivo_url, arquivo_hash, arquivo_ausente')
          .eq('origem_ref', docId)
          .eq('colaborador_id', colaborador.id)
          .maybeSingle();
        let existingDoc = existingByNew;
        if (!existingDoc && asoLike) {
          const { data: legacy } = await supabase
            .from('gt_documentos')
            .select('id, arquivo_path, arquivo_url, arquivo_hash, arquivo_ausente')
            .eq('origem_ref', `mio_treinamento_${tre.id}`)
            .eq('colaborador_id', colaborador.id)
            .maybeSingle();
          existingDoc = legacy;
        }

        const statusValidacao = getStatusValidacao(dataValidade, tipoDocumento);
        const numeroRastreio = existingDoc
          ? undefined
          : await garantirNumeroRastreioUnico(tipoDocumento, cpfLimpo);

        const docData: Record<string, unknown> = {
          colaborador_id: colaborador.id,
          tipo_documento: tipoDocumento,
          subtipo: tre.codigo_treinamento || tre.area || undefined,
          titulo: tre.nome_curso || tre.descricao || `${asoLike ? 'ASO' : 'Treinamento'} ${tre.id}`,
          descricao: tre.observacoes || undefined,
          numero_documento: tre.numero_documento || undefined,
          orgao_emissor: tre.local_realizacao || tre.instituicao || undefined,
          data_emissao: dataConclusao || undefined,
          data_validade: dataValidade || undefined,
          status_validacao: statusValidacao,
          origem: 'mio' as const,
          origem_ref: docId,
          status_revisao: 'nao_necessita' as const,
        };
        if (numeroRastreio) docData.numero_rastreio = numeroRastreio;

        if (existingDoc) {
          const { error: updateErr } = await supabase
            .from('gt_documentos')
            .update({ ...docData, updated_at: new Date().toISOString() })
            .eq('id', existingDoc.id);

          if (updateErr) {
            erros.push(`Erro ao atualizar ${tipoDocumento} ${tre.nome_curso}: ${updateErr.message}`);
          } else {
            atualizados.push(tre.nome_curso || docId);
            if (asoLike) {
              await upsertAsoChild(existingDoc.id, colaborador.id, tre, dataConclusao);
            } else {
              await supabase
                .from('gt_documentos_treinamento')
                .upsert({
                  documento_id: existingDoc.id,
                  colaborador_id: colaborador.id,
                  nome_curso: tre.nome_curso,
                  instituicao: tre.instituicao || tre.local_realizacao,
                  carga_horaria: tre.carga_horaria ? Math.round(tre.carga_horaria) : null,
                  tipo_curso: tre.area,
                }, { onConflict: 'documento_id' });
            }
            await anexarDocumentoSePreciso({
              existing: existingDoc,
              colaboradorId: colaborador.id,
              documentoId: existingDoc.id,
              origemRef: docId,
              treinamentoId: String(tre.id),
              anexoUrl: tre.anexo_url,
              contemAnexo: tre.contem_anexo,
              record: tre as unknown as Record<string, unknown>,
            });
          }
        } else {
          const { data: insertedDoc, error: insertErr } = await supabase
            .from('gt_documentos')
            .insert(docData)
            .select('id')
            .single();

          if (insertErr) {
            erros.push(`Erro ao importar ${tipoDocumento} ${tre.nome_curso}: ${insertErr.message}`);
          } else {
            importados.push(tre.nome_curso || docId);
            if (asoLike) {
              await upsertAsoChild(insertedDoc.id, colaborador.id, tre, dataConclusao);
            } else {
              const { error: treInsertErr } = await supabase
                .from('gt_documentos_treinamento')
                .insert({
                  documento_id: insertedDoc.id,
                  colaborador_id: colaborador.id,
                  nome_curso: tre.nome_curso,
                  instituicao: tre.instituicao || tre.local_realizacao,
                  carga_horaria: tre.carga_horaria ? Math.round(tre.carga_horaria) : null,
                  tipo_curso: tre.area,
                });
              if (treInsertErr) {
                console.error(`Erro ao inserir dados treinamento: ${treInsertErr.message}`);
              }
            }
            await anexarDocumentoSePreciso({
              existing: null,
              colaboradorId: colaborador.id,
              documentoId: insertedDoc.id,
              origemRef: docId,
              treinamentoId: String(tre.id),
              anexoUrl: tre.anexo_url,
              contemAnexo: tre.contem_anexo,
              record: tre as unknown as Record<string, unknown>,
            });
          }
        }
      } catch (err) {
        erros.push(`Erro ao processar treinamento ${tre.nome_curso}: ${err}`);
      }
    }

    return {
      success: true,
      data: {
        importados: importados.length,
        atualizados: atualizados.length,
        ignorados: ignorados.length,
        erros,
      },
    };
  } catch (error) {
    console.error('Erro em syncTreinamentosFromMIO:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function syncEmbarquesFromMIO(): Promise<{
  success: boolean;
  data?: { importados: number; atualizados: number; ignorados: number; erros: string[]; lgp_range?: unknown };
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin;
    const lgpRaw = (await mioClient.getLGPReportsRaw()) as RawLGPRecord[];

    if (!lgpRaw || lgpRaw.length === 0) {
      return { success: false, error: 'Nenhum embarque retornado do MIO' };
    }

    const byCpf = new Map<string, RawLGPRecord[]>();
    for (const record of lgpRaw) {
      const cpf = String(record.CPF || '').replace(/\D/g, '');
      if (!cpf) continue;
      const list = byCpf.get(cpf) || [];
      list.push(record);
      byCpf.set(cpf, list);
    }

    let importados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    const upsertEmb = async (payload: {
      colaborador_id: string;
      tipo: string;
      data_embarque: string;
      data_desembarque?: string | null;
      data_prevista_desembarque?: string | null;
      local_embarque?: string | null;
      local_desembarque?: string | null;
      observacoes?: string | null;
      mio_embarque_id: string;
    }) => {
      const { data: existingEmb } = await supabase
        .from('gt_historico_embarques')
        .select('id, origem, deleted_at')
        .eq('mio_embarque_id', payload.mio_embarque_id)
        .eq('colaborador_id', payload.colaborador_id)
        .maybeSingle();

      if (existingEmb?.deleted_at) {
        // Registro excluído localmente pelo usuário — preservar exclusão
        return;
      }

      if (existingEmb?.origem === 'local') {
        // Registro editado localmente pelo usuário — preservar alterações locais
        return;
      }

      const row = {
        ...payload,
        origem: 'mio' as const,
        updated_at: new Date().toISOString(),
      };

      if (existingEmb) {
        const { error: updateErr } = await supabase
          .from('gt_historico_embarques')
          .update(row)
          .eq('id', existingEmb.id);
        if (updateErr) erros.push(`Erro ao atualizar embarque ${payload.mio_embarque_id}: ${updateErr.message}`);
        else atualizados++;
      } else {
        const { error: insertErr } = await supabase.from('gt_historico_embarques').insert(row);
        if (insertErr) erros.push(`Erro ao importar embarque ${payload.mio_embarque_id}: ${insertErr.message}`);
        else importados++;
      }
    };

    for (const [cpfLimpo, records] of byCpf) {
      const colaborador = await findColaboradorByCpf(cpfLimpo);
      if (!colaborador) {
        ignorados += records.length;
        continue;
      }

      const sorted = records.slice().sort((a, b) => {
        const da = lgpRotationStart(a) || '';
        const db = lgpRotationStart(b) || '';
        return da.localeCompare(db);
      });

      for (let i = 0; i < sorted.length; i++) {
        try {
          const record = sorted[i];
          const next = i + 1 < sorted.length ? sorted[i + 1] : null;
          const dataEmbarque = cleanDate(lgpRotationStart(record));
          if (!dataEmbarque) {
            ignorados++;
            continue;
          }
          const dataDesembarque = cleanDate(record['Desembarque Real'] || lgpRotationEnd(record));
          const dataPrevista = cleanDate(record['Prev. Desemb. RTPD'] || record['Prev. Desemb.']);
          const { type, extraPeriods } = detectRotationType(record, next);
          const nrRtpe = String(record['Nº RTPE'] || '');
          const mioId = `mio_lgp_${cpfLimpo}_${dataEmbarque}_${nrRtpe || i}`;
          const embarqueReal = Boolean(record['Embarque Real']);
          const tipoPrincipal = type === 'normal' && !embarqueReal ? 'previsto' : type;
          const prevEmb = cleanDate(record['Prev. de Emb.']);
          const realEmb = cleanDate(record['Embarque Real']);

          await upsertEmb({
            colaborador_id: colaborador.id,
            tipo: tipoPrincipal,
            data_embarque: dataEmbarque,
            data_desembarque: dataDesembarque,
            data_prevista_desembarque: dataPrevista,
            local_embarque: record.Origem || undefined,
            local_desembarque: record.Destino || undefined,
            observacoes: composeLgpObservacoes(embarqueReal, record['RTPE Status'] ? String(record['RTPE Status']) : null),
            mio_embarque_id: mioId,
          });

          if (prevEmb && realEmb && prevEmb < realEmb) {
            await upsertEmb({
              colaborador_id: colaborador.id,
              tipo: 'previsto',
              data_embarque: prevEmb,
              data_desembarque: realEmb,
              local_embarque: record.Origem || undefined,
              local_desembarque: record.Destino || undefined,
              observacoes: composeLgpObservacoes(false, record['RTPE Status'] ? String(record['RTPE Status']) : null),
              mio_embarque_id: `${mioId}_previsto_${prevEmb}`,
            });
          }

          for (const extra of extraPeriods) {
            if (!extra.start) continue;
            await upsertEmb({
              colaborador_id: colaborador.id,
              tipo: extra.type,
              data_embarque: extra.start,
              data_desembarque: extra.end || undefined,
              local_embarque: record.Origem || undefined,
              local_desembarque: record.Destino || undefined,
              observacoes: `LGP extra ${extra.type} from ${mioId}`,
              mio_embarque_id: `${mioId}_${extra.type}_${extra.start}`,
            });
          }
        } catch (err) {
          erros.push(`Erro ao processar embarque CPF ${cpfLimpo}: ${err}`);
        }
      }

      const hojeIso = dataLocalISO();
      let statusAtual: 'embarcado' | 'folga' | 'desembarcado' = 'desembarcado';
      let ultimoEmb: string | undefined;
      let ultimoDes: string | undefined;
      for (const record of sorted) {
        const realEmb = cleanDate(record['Embarque Real']);
        const realDes = cleanDate(record['Desembarque Real']);
        const start = cleanDate(lgpRotationStart(record));
        if (!start || start > hojeIso) continue;
        if (realEmb && realEmb <= hojeIso && (!realDes || realDes > hojeIso)) {
          statusAtual = 'embarcado';
          ultimoEmb = realEmb;
        } else if (realDes && realDes <= hojeIso) {
          statusAtual = 'folga';
          ultimoDes = realDes;
        }
      }
      const statusPatch: Record<string, unknown> = {
        status_embarque: statusAtual,
        standby: false,
        updated_at: new Date().toISOString(),
      };
      if (ultimoEmb) statusPatch.data_ultimo_embarque = ultimoEmb;
      if (ultimoDes) statusPatch.data_ultimo_desembarque = ultimoDes;
      await supabase.from('gt_colaboradores').update(statusPatch).eq('id', colaborador.id);
    }

    await persistMioCacheRow('lgp_reports', lgpRaw);

    return {
      success: true,
      data: {
        importados,
        atualizados,
        ignorados,
        erros,
        lgp_range: mioClient.lastLgpRange,
      },
    };
  } catch (error) {
    console.error('Erro em syncEmbarquesFromMIO:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function syncToMIO(): Promise<{
  success: boolean;
  data?: { enviados: number; erros: string[] };
  error?: string;
}> {
  const msg = '[MIO] Forbidden write blocked: syncToMIO is disabled. MIO is read-only; pull only.';
  console.error(msg);
  return { success: true, data: { enviados: 0, erros: [] } };
}

async function syncColaboradorUserLinks(): Promise<{ linkados: number; erros: string[] }> {
  const supabase = supabaseAdmin;
  const erros: string[] = [];
  let linkados = 0;

  try {
    const { data: semLink } = await supabase
      .from('gt_colaboradores')
      .select('id, cpf')
      .is('user_id', null)
      .not('cpf', 'is', null);

    if (!semLink || semLink.length === 0) return { linkados: 0, erros: [] };

    const cpfs = semLink.map(c => c.cpf);
    const { data: users } = await supabase
      .from('users_unified')
      .select('id, tax_id')
      .in('tax_id', cpfs);

    if (!users || users.length === 0) return { linkados: 0, erros: [] };

    const userByTaxId = new Map(users.map(u => [u.tax_id, u.id]));

    for (const col of semLink) {
      const userId = userByTaxId.get(col.cpf);
      if (userId) {
        const { error: updErr } = await supabase
          .from('gt_colaboradores')
          .update({ user_id: userId, updated_at: new Date().toISOString() })
          .eq('id', col.id);

        if (updErr) {
          erros.push(`Erro ao linkar colaborador ${col.id}: ${updErr.message}`);
        } else {
          linkados++;
        }
      }
    }
  } catch (err) {
    erros.push(`Erro ao sincronizar links: ${err}`);
  }

  return { linkados, erros };
}

/** Persiste o resultado da última execução em gt_configuracoes (chave 'mio_sync_ultimo_resultado'). */
async function salvarUltimoResultado(resultado: Record<string, unknown>): Promise<void> {
  try {
    const payload = { ...resultado, executado_em: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from('gt_configuracoes')
      .upsert(
        {
          chave: 'mio_sync_ultimo_resultado',
          valor: payload,
          descricao: 'Resultado da última sincronização MIO → portal (Gestão de Tripulantes)',
        },
        { onConflict: 'chave' }
      );
    if (error) {
      console.error('[MIO Sync] Falha ao persistir último resultado:', error.message);
    }
  } catch (e) {
    console.error('[MIO Sync] Exceção ao persistir último resultado:', e);
  }
}

/**
 * Provisionamento de usuários do portal (users_unified) a partir dos integrantes do MIO.
 * Idempotente: localiza por mio_id → tax_id (CPF digits-only) → email; nunca duplica.
 */
export async function syncUsuariosPortal(): Promise<{
  success: boolean;
  criados: number;
  atualizados: number;
  ignorados: number;
  total: number;
  erros: string[];
}> {
  console.log('[MIO Sync] Iniciando sincronização de usuários do portal...');
  const supabase = supabaseAdmin;

  let integrantes: MIOIntegrante[] = [];
  try {
    integrantes = await mioClient.getIntegrantes();
  } catch (e: any) {
    return { success: false, criados: 0, atualizados: 0, ignorados: 0, total: 0, erros: [e?.message || String(e)] };
  }

  if (!integrantes || integrantes.length === 0) {
    console.log('[MIO Sync] Nenhum integrante encontrado ou falha na conexão.');
    return { success: false, criados: 0, atualizados: 0, ignorados: 0, total: 0, erros: ['Nenhum integrante encontrado ou falha na conexão.'] };
  }

  let criadosCount = 0;
  let atualizadosCount = 0;
  let ignoradosCount = 0;
  const erros: string[] = [];

  const defaultModules = [
    'dashboard', 'manual', 'procedimentos', 'politicas', 'calendario',
    'noticias', 'reembolso', 'contracheque', 'ponto'
  ];

  for (const integrante of integrantes) {
    try {
      // Borda: sem nome/CPF → logar, pular e contabilizar.
      const taxId = integrante.cpf?.replace(/\D/g, '');
      const email = integrante.email?.trim().toLowerCase() || null;

      if (!integrante.nome || !taxId) {
        console.warn(`[MIO Sync] Usuário ignorado (sem nome/CPF): ${integrante.nome || 'Sem Nome'} (id ${integrante.id ?? '?'})`);
        ignoradosCount++;
        continue;
      }

      // Upsert idempotente: mio_id → CPF → email.
      let targetUser: any = null;

      const mioIdStr = integrante.id != null ? String(integrante.id) : null;
      if (mioIdStr) {
        const { data: userByMio } = await supabase
          .from('users_unified')
          .select('*')
          .eq('mio_id', mioIdStr)
          .maybeSingle();
        if (userByMio) targetUser = userByMio;
      }

      if (!targetUser) {
        const { data: userByCpf } = await supabase
          .from('users_unified')
          .select('*')
          .eq('tax_id', taxId)
          .maybeSingle();
        if (userByCpf) {
          targetUser = userByCpf;
        } else if (email) {
          const { data: userByEmail } = await supabase
            .from('users_unified')
            .select('*')
            .eq('email', email)
            .maybeSingle();
          if (userByEmail) {
            targetUser = userByEmail;
          }
        }
      }

      const isMioActive = integrante.situacao === 'Ativo';

      if (targetUser) {
        const updatePayload: any = {
          position: integrante.cargo || targetUser.position,
          department: integrante.setor || integrante.departamento || targetUser.department,
          mio_id: mioIdStr ?? targetUser.mio_id,
          mio_matricula: integrante.matricula || targetUser.mio_matricula,
          mio_data: integrante,
          mio_last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active: isMioActive,
          authorization_status: isMioActive ? 'active' : 'pending'
        };

        if (!targetUser.tax_id && taxId) {
          updatePayload.tax_id = taxId;
        }

        const { error: updateErr } = await supabase
          .from('users_unified')
          .update(updatePayload)
          .eq('id', targetUser.id);

        if (updateErr) {
          console.error(`[MIO Sync] Erro ao atualizar usuário ${targetUser.id}:`, updateErr.message);
          erros.push(`Atualização falhou para ${integrante.nome} (CPF: ${taxId}): ${updateErr.message}`);
        } else {
          atualizadosCount++;
        }
        continue;
      }

      const hasValidEmail = !!email && email.includes('@') && !email.includes('placeholder.com');
      const firstName = integrante.nome.split(' ')[0];
      const lastName = integrante.nome.split(' ').slice(1).join(' ');
      const protocol = `REG-MIO-${new Date().toISOString().replace(/\D/g, '').slice(2, 10)}-${uuidv4().slice(0, 4).toUpperCase()}`;
      const emailVerificationToken = uuidv4();

      let userId: string;

      if (hasValidEmail) {
        let authUser: any = null;
        const temporaryPassword = uuidv4().substring(0, 8);

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: email!,
          password: temporaryPassword,
          user_metadata: { first_name: firstName, last_name: lastName, role: 'USER' }
        });

        if (authError) {
          const msg = (authError.message || '').toLowerCase();
          const isEmailExists = msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate') || (authError as any)?.code === 'email_exists' || (authError as any)?.status === 422;

          if (isEmailExists) {
            const perPage = 200;
            for (let page = 1; page <= 5 && !authUser; page++) {
              const listRes = await (supabase as any).auth.admin.listUsers({ page, perPage });
              const users = listRes?.data?.users || listRes?.users || [];
              authUser = users.find((u: any) => (u.email || '').toLowerCase() === email);
              if (users.length < perPage) break;
            }
          }

          if (!authUser) {
            console.error(`[MIO Sync] Erro no Auth para ${email}:`, authError.message);
            erros.push(`Erro de Auth para ${integrante.nome} (CPF: ${taxId}): ${authError.message}`);
            userId = uuidv4();
          } else {
            userId = authUser.id;
          }
        } else {
          userId = authData.user!.id;
        }
      } else {
        userId = uuidv4();
      }

      const baseUserData: any = {
        id: userId,
        email: email || `${taxId}@mio.sync`,
        phone_number: integrante.celular || integrante.telefone || null,
        first_name: firstName,
        last_name: lastName,
        position: integrante.cargo || 'Não informado',
        department: integrante.setor || integrante.departamento || 'Não informado',
        tax_id: taxId,
        role: 'USER',
        active: isMioActive,
        is_authorized: true,
        authorization_status: isMioActive ? 'active' : 'pending',
        email_verified: false,
        email_verification_token: hasValidEmail ? emailVerificationToken : null,
        mio_id: mioIdStr,
        mio_matricula: integrante.matricula || null,
        mio_data: integrante,
        mio_last_sync: new Date().toISOString(),
        protocol: protocol,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Rede de segurança anti-duplicidade antes do insert.
      const orFilters = [`tax_id.eq.${taxId}`];
      if (email) orFilters.push(`email.eq.${email}`);
      if (mioIdStr) orFilters.push(`mio_id.eq.${mioIdStr}`);
      const { data: existingUnified } = await supabase
        .from('users_unified')
        .select('id')
        .or(orFilters.join(','))
        .maybeSingle();

      if (existingUnified) {
        const { error: updateErr } = await supabase
          .from('users_unified')
          .update({
            phone_number: integrante.celular || integrante.telefone || null,
            first_name: firstName,
            last_name: lastName,
            position: integrante.cargo || 'Não informado',
            department: integrante.setor || integrante.departamento || 'Não informado',
            mio_id: mioIdStr,
            mio_matricula: integrante.matricula || null,
            mio_data: integrante,
            mio_last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            active: isMioActive,
            authorization_status: isMioActive ? 'active' : 'pending'
          })
          .eq('id', existingUnified.id);

        if (updateErr) {
          console.error(`[MIO Sync] Erro ao atualizar users_unified para ${integrante.nome}:`, updateErr.message);
          erros.push(`Atualização users_unified falhou para ${integrante.nome} (CPF: ${taxId}): ${updateErr.message}`);
        } else {
          atualizadosCount++;
        }
        continue;
      }

      const { error: insertErr } = await supabase
        .from('users_unified')
        .insert(baseUserData);

      if (insertErr) {
        console.error(`[MIO Sync] Erro ao cadastrar users_unified para ${integrante.nome}:`, insertErr.message);
        erros.push(`Cadastro users_unified falhou para ${integrante.nome} (CPF: ${taxId}): ${insertErr.message}`);
        continue;
      }

      const { data: existingPerms } = await supabase
        .from('user_permissions')
        .select('module')
        .eq('user_id', userId);

      const existingModules = new Set(existingPerms?.map(p => p.module) || []);
      const permissionsToInsert = defaultModules
        .filter(module => !existingModules.has(module))
        .map(module => ({ user_id: userId, module, feature: null }));

      if (permissionsToInsert.length > 0) {
        const { error: permErr } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);
        if (permErr) {
          console.error(`[MIO Sync] Erro ao adicionar permissões para ${integrante.nome}:`, permErr.message);
        }
      }

      await supabase.from('access_history').insert({
        user_id: userId,
        action: 'REGISTERED',
        details: `Usuário registrado via sincronização automática MIO. Protocolo: ${protocol}`,
        ip_address: 'system-sync',
        user_agent: 'MIO Sync Service'
      }).then(({ error: histErr }) => {
        if (histErr) console.error('[MIO Sync] Erro ao registrar histórico:', histErr.message);
      });

      if (hasValidEmail) {
        const sendResult = await sendEmailVerificationLink(email!, firstName, emailVerificationToken);
        if (!sendResult.success) {
          console.error(`[MIO Sync] Erro ao enviar email de verificação para ${email}:`, sendResult.message);
        }
      }

      criadosCount++;
    } catch (err: any) {
      console.error(`[MIO Sync] Erro ao processar ${integrante.cpf}:`, err);
      erros.push(`Erro geral processando ${integrante.nome || 'Sem Nome'} (CPF: ${integrante.cpf}): ${err.message || err}`);
    }
  }

  return {
    success: erros.length === 0,
    criados: criadosCount,
    atualizados: atualizadosCount,
    ignorados: ignoradosCount,
    total: integrantes.length,
    erros
  };
}

export async function syncAfastamentosFromMIO(): Promise<{
  success: boolean;
  data?: { importados: number; atualizados: number; ignorados: number; erros: string[] };
  error?: string;
}> {
  try {
    const rows = await mioClient.getAfastamentos();
    if (!rows || rows.length === 0) {
      return { success: true, data: { importados: 0, atualizados: 0, ignorados: 0, erros: [] } };
    }

    let importados = 0;
    let atualizados = 0;
    let ignorados = 0;
    const erros: string[] = [];

    for (const raw of rows) {
      try {
        const cpf = String(raw.cpf || raw.CPF || raw.cpf_numero || '').replace(/\D/g, '');
        if (!cpf) {
          ignorados++;
          continue;
        }
        const colaborador = await findColaboradorByCpf(cpf);
        if (!colaborador) {
          ignorados++;
          continue;
        }
        const dataInicio = cleanDate(raw.data_inicio || raw.inicio || raw['Data Início'] || raw.data_afastamento);
        if (!dataInicio) {
          ignorados++;
          continue;
        }
        const origemRef = `mio_afast_${raw.id || raw.ID || `${cpf}_${dataInicio}`}`;
        const { data: existing } = await supabaseAdmin
          .from('gt_afastamentos')
          .select('id')
          .eq('colaborador_id', colaborador.id)
          .eq('data_inicio', dataInicio)
          .maybeSingle();

        const payload = {
          colaborador_id: colaborador.id,
          tipo_afastamento: mapTipoAfastamento(raw),
          motivo: raw.motivo || raw.Motivo || raw.observacoes || null,
          data_inicio: dataInicio,
          data_fim: cleanDate(raw.data_fim || raw.fim || raw['Data Fim']) || null,
          origem: 'mio',
          observacoes: origemRef,
        };

        if (existing) {
          const { error } = await supabaseAdmin.from('gt_afastamentos').update(payload).eq('id', existing.id);
          if (error) erros.push(error.message);
          else atualizados++;
        } else {
          const { error } = await supabaseAdmin.from('gt_afastamentos').insert(payload);
          if (error) erros.push(error.message);
          else importados++;
        }
      } catch (err) {
        erros.push(String(err));
      }
    }

    return { success: true, data: { importados, atualizados, ignorados, erros } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      data: { importados: 0, atualizados: 0, ignorados: 0, erros: [String(error)] },
    };
  }
}

function mapTipoAfastamento(raw: Record<string, unknown>): string {
  const blob = `${raw.tipo || raw.tipo_afastamento || raw.Tipo || ''}`.toLowerCase();
  if (blob.includes('acid')) return 'acidente_trabalho';
  if (blob.includes('matern')) return 'licenca_maternidade';
  if (blob.includes('patern')) return 'licenca_paternidade';
  if (blob.includes('ferias') || blob.includes('férias')) return 'ferias';
  if (blob.includes('militar')) return 'servico_militar';
  if (blob.includes('sindic')) return 'mandato_sindical';
  if (blob.includes('medic')) return 'licenca_medica';
  if (blob.includes('doenc') || blob.includes('doenç')) return 'doenca';
  return 'outro';
}

async function persistMioCacheRow(tipo: string, dados: unknown[]): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin.from('mio_cache').upsert(
    {
      tipo,
      dados: JSON.stringify(dados || []),
      total_registros: Array.isArray(dados) ? dados.length : 0,
      atualizado_em: now,
    },
    { onConflict: 'tipo' }
  );
}

async function upsertMioEntidade(opts: {
  tipo: string;
  origemRef: string;
  cpf?: string;
  dados: Record<string, unknown>;
}): Promise<void> {
  const cpf = opts.cpf ? opts.cpf.replace(/\D/g, '') : '';
  const colaborador = cpf ? await findColaboradorByCpf(cpf) : null;
  const payload = {
    tipo: opts.tipo,
    origem_ref: opts.origemRef,
    colaborador_id: colaborador?.id || null,
    cpf: cpf || null,
    dados: opts.dados,
    origem: 'mio',
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabaseAdmin
    .from('gt_mio_entidades')
    .select('id')
    .eq('origem_ref', opts.origemRef)
    .maybeSingle();
  if (existing) {
    await supabaseAdmin.from('gt_mio_entidades').update(payload).eq('id', existing.id);
  } else {
    await supabaseAdmin.from('gt_mio_entidades').insert(payload);
  }
}

export async function syncAsosFromMioProbe(): Promise<{
  success: boolean;
  data: {
    importados: number;
    atualizados: number;
    ignorados: number;
    erros: string[];
    probe_hits: unknown;
    probe_misses: unknown;
  };
}> {
  const probe = await mioClient.probeAsoReadPaths();
  let importados = 0;
  let atualizados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  await upsertMioEntidade({
    tipo: 'aso_probe_evidence',
    origemRef: 'mio_aso_probe_meta',
    dados: { hits: probe.hits, misses: probe.misses, count: probe.records.length },
  });

  for (const raw of probe.records) {
    try {
      const cpf = String(raw.cpf || raw.CPF || '').replace(/\D/g, '');
      if (!cpf) {
        ignorados++;
        continue;
      }
      const colaborador = await findColaboradorByCpf(cpf);
      if (!colaborador) {
        ignorados++;
        continue;
      }
      const mioId = String(raw.id || raw.ID || `${cpf}_${raw.concluido_em || raw['Concluído Em'] || importados}`);
      const origemRef = `mio_aso_${mioId}`;
      const dataRealizacao = cleanDate(
        String(raw.concluido_em || raw['Concluído Em'] || raw.data_realizacao || '')
      );
      const dataValidade = cleanDate(
        String(raw.vencimento_em || raw['Vencimento Em'] || raw.data_validade || '')
      );

      const { data: existing } = await supabaseAdmin
        .from('gt_documentos')
        .select('id')
        .eq('origem_ref', origemRef)
        .eq('colaborador_id', colaborador.id)
        .maybeSingle();

      const docData: Record<string, unknown> = {
        colaborador_id: colaborador.id,
        tipo_documento: 'aso',
        titulo: String(raw.tipo_aso || raw.Tipo || 'ASO MIO'),
        descricao: raw.obs ? String(raw.obs) : undefined,
        data_emissao: dataRealizacao || undefined,
        data_validade: dataValidade || undefined,
        status_validacao: getStatusValidacao(dataValidade, 'aso'),
        origem: 'mio',
        origem_ref: origemRef,
        status_revisao: 'nao_necessita',
      };

      let documentoId = existing?.id;
      if (existing) {
        const { error } = await supabaseAdmin.from('gt_documentos').update({
          ...docData,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (error) {
          erros.push(error.message);
          continue;
        }
        atualizados++;
      } else {
        docData.numero_rastreio = await garantirNumeroRastreioUnico('aso', cpf);
        const { data: inserted, error } = await supabaseAdmin
          .from('gt_documentos')
          .insert(docData)
          .select('id')
          .single();
        if (error || !inserted) {
          erros.push(error?.message || 'insert aso failed');
          continue;
        }
        documentoId = inserted.id;
        importados++;
      }

      const fakeTre = {
        nome_curso: String(raw.tipo_aso || 'ASO'),
        tipo_documento: String(raw.tipo_aso || 'ASO'),
      };
      await upsertAsoChild(documentoId!, colaborador.id, fakeTre as MIOTreinamento, dataRealizacao);
      await anexarArquivoMioSeHouver({
        colaboradorId: colaborador.id,
        documentoId: documentoId!,
        origemRef,
        treinamentoId: mioId,
        anexoUrl: String(raw.hiperlink_externo || raw.anexo_url || raw.url || '') || null,
        record: raw,
      });
    } catch (err) {
      erros.push(String(err));
    }
  }

  return {
    success: true,
    data: {
      importados,
      atualizados,
      ignorados,
      erros,
      probe_hits: probe.hits,
      probe_misses: probe.misses,
    },
  };
}

export async function syncMioEntidadesExtras(): Promise<{
  success: boolean;
  data: Record<string, number>;
  erros: string[];
}> {
  const erros: string[] = [];
  const counts: Record<string, number> = {};

  const persistList = async (tipo: string, rows: unknown[]) => {
    counts[tipo] = rows.length;
    if (rows.length >= 200) {
      pullLog(`[MIO pull] ${tipo} returned ${rows.length} (docs cap 200) — expanding per-CPF`);
      const { data: cols } = await supabaseAdmin.from('gt_colaboradores').select('cpf').is('deleted_at', null);
      const extra: unknown[] = [...rows];
      const seen = new Set(rows.map((r) => JSON.stringify(r)));
      for (const col of cols || []) {
        const cpf = String(col.cpf || '').replace(/\D/g, '');
        if (cpf.length !== 11) continue;
        let part: unknown[] = [];
        if (tipo === 'beneficio') part = await mioClient.getFilteredList('GET', '/int-integrantes-beneficio-get', { cpf }, 'beneficio');
        else if (tipo === 'dependente') part = await mioClient.getFilteredList('GET', '/int-integrantes-dependente-get', { cpf }, 'dependente');
        else if (tipo === 'sispat') part = await mioClient.getFilteredList('GET', '/lgp-sispat-get', { cpf }, 'sispat');
        else if (tipo === 'ferias') part = await mioClient.getFilteredList('GET', '/int-integrantes-ferias-get', { cpf }, 'ferias');
        else continue;
        for (const row of part) {
          const key = JSON.stringify(row);
          if (seen.has(key)) continue;
          seen.add(key);
          extra.push(row);
        }
      }
      rows = extra;
      counts[tipo] = extra.length;
      counts[`${tipo}_capped_expanded`] = extra.length;
    }
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      if (i === 0 || (i + 1) % 50 === 0 || i + 1 === rows.length) {
        pullLog(`[MIO pull] persist ${tipo} ${i + 1}/${rows.length}`);
      }
      const rec = (raw || {}) as Record<string, unknown>;
      const id = rec.id ?? rec.ID ?? rec.numero_sispat ?? JSON.stringify(rec).slice(0, 40);
      const cpf = String(rec.cpf || rec.CPF || '');
      await upsertMioEntidade({
        tipo,
        origemRef: `mio_${tipo}_${id}`,
        cpf,
        dados: rec,
      });
    }
  };

  try {
    await persistList('ferias', await mioClient.getFerias());
  } catch (e) {
    erros.push(`ferias: ${e}`);
  }
  try {
    await persistList('beneficio', await mioClient.getBeneficios());
  } catch (e) {
    erros.push(`beneficio: ${e}`);
  }
  try {
    await persistList('dependente', await mioClient.getDependentes());
  } catch (e) {
    erros.push(`dependente: ${e}`);
  }
  try {
    await persistList('sispat', await mioClient.getSispat());
  } catch (e) {
    erros.push(`sispat: ${e}`);
  }
  try {
    await persistList('rtpe_turma', await mioClient.getRtpeTurmas());
  } catch (e) {
    erros.push(`rtpe_turma: ${e}`);
  }
  try {
    await persistList('treinamento_turma', await mioClient.getTreinamentoTurmas());
  } catch (e) {
    erros.push(`treinamento_turma: ${e}`);
  }
  try {
    const agora = new Date();
    const tsMerged: unknown[] = [];
    const tsSeen = new Set<string>();
    const tsWindows: Array<[string, string]> = [
      [`${agora.getFullYear() - 15}-01-01`, `${agora.getFullYear() + 1}-12-31`],
    ];
    for (let endYear = agora.getFullYear() - 16; endYear >= 1990; endYear -= 5) {
      const startYear = Math.max(endYear - 4, 1990);
      tsWindows.push([`${startYear}-01-01`, `${endYear}-12-31`]);
    }
    for (const [ini, fim] of tsWindows) {
      pullLog(`[MIO pull] timesheet ${ini}..${fim}`);
      try {
        const part = await mioClient.getTimesheet(ini, fim);
        for (const row of part) {
          const key = JSON.stringify(row);
          if (tsSeen.has(key)) continue;
          tsSeen.add(key);
          tsMerged.push(row);
        }
      } catch (chunkErr) {
        erros.push(`timesheet ${ini}..${fim}: ${chunkErr}`);
        break;
      }
    }
    await persistList('timesheet', tsMerged);
  } catch (e) {
    erros.push(`timesheet: ${e}`);
  }

  return { success: erros.length === 0, data: counts, erros };
}

export async function syncAllFromMIO(): Promise<{
  success: boolean;
  data?: {
    colaboradores: { importados: number; atualizados: number; ignorados: number; inativados: number; erros: string[] };
    treinamentos: { importados: number; atualizados: number; ignorados: number; erros: string[] };
    asos_probe: { importados: number; atualizados: number; ignorados: number; erros: string[]; probe_hits: unknown; probe_misses: unknown };
    embarques: { importados: number; atualizados: number; ignorados: number; erros: string[]; lgp_range?: unknown };
    afastamentos: { importados: number; atualizados: number; ignorados: number; erros: string[] };
    entidades: Record<string, number>;
    usuarios: { criados: number; atualizados: number; ignorados: number; total: number; erros: string[] };
  };
  error?: string;
}> {
  return runMioPull(async () => {
  console.log('[MIO pull] Full sync starting (read-only from MIO, persist locally)');
  console.log('[MIO Sync] Sincronizando Usuários Portal...');
  const userResult = await syncUsuariosPortal().catch(e => {
    console.error('[MIO Sync] Erro ao sincronizar Usuários Portal:', e);
    return { success: false, criados: 0, atualizados: 0, ignorados: 0, total: 0, erros: [e?.message || String(e)] };
  });

  console.log('[MIO Sync] Iniciando sincronização de colaboradores/documentos...');

  const colResult = await syncFromMIO();
  console.log('[MIO Sync] Colaboradores:', colResult.success ? 'OK' : 'ERRO', colResult.data);

  const treResult = await syncTreinamentosFromMIO();
  pullLog(`[MIO Sync] Treinamentos: ${treResult.success ? 'OK' : 'ERRO'} ${JSON.stringify(treResult.data || treResult.error)}`);

  const asoResult = await syncAsosFromMioProbe().catch((e) => ({
    success: false,
    data: { importados: 0, atualizados: 0, ignorados: 0, erros: [String(e)], probe_hits: [], probe_misses: [] },
  }));
  console.log('[MIO Sync] ASO probe:', asoResult.data);

  const embResult = await syncEmbarquesFromMIO();
  console.log('[MIO Sync] Embarques:', embResult.success ? 'OK' : 'ERRO', embResult.data);

  const afaResult = await syncAfastamentosFromMIO();
  console.log('[MIO Sync] Afastamentos:', afaResult.success ? 'OK' : 'ERRO', afaResult.data);

  const entResult = await syncMioEntidadesExtras().catch((e) => ({
    success: false,
    data: {},
    erros: [String(e)],
  }));
  console.log('[MIO Sync] Entidades extras:', entResult.data, entResult.erros);

  console.log('[MIO Sync] Linkando colaboradores a usuários do portal...');
  const linkResult = await syncColaboradorUserLinks();
  console.log(`[MIO Sync] Colaboradores linkados: ${linkResult.linkados}`);

  const allSuccess = colResult.success && treResult.success && embResult.success && userResult.success;

  const resultadoFinal = {
    success: allSuccess,
    error: allSuccess ? null : 'Alguns módulos falharam na sincronização',
    colaboradores: colResult.data || { importados: 0, atualizados: 0, ignorados: 0, inativados: 0, erros: [] },
    treinamentos: treResult.data || { importados: 0, atualizados: 0, ignorados: 0, erros: [] },
    asos_probe: asoResult.data,
    embarques: embResult.data || { importados: 0, atualizados: 0, ignorados: 0, erros: [] },
    afastamentos: afaResult.data || { importados: 0, atualizados: 0, ignorados: 0, erros: [] },
    entidades: entResult.data,
    entidades_erros: entResult.erros,
    aso_probe_evidence: mioClient.lastAsoProbe,
    lgp_range: mioClient.lastLgpRange,
    usuarios: {
      criados: userResult.criados || 0,
      atualizados: userResult.atualizados || 0,
      ignorados: userResult.ignorados || 0,
      total: userResult.total || 0,
      erros: userResult.erros || []
    },
    usuarios_linkados: linkResult.linkados
  };

  await salvarUltimoResultado(resultadoFinal);

  return {
    success: allSuccess,
    data: {
      colaboradores: resultadoFinal.colaboradores,
      treinamentos: resultadoFinal.treinamentos,
      asos_probe: resultadoFinal.asos_probe,
      embarques: resultadoFinal.embarques,
      afastamentos: resultadoFinal.afastamentos,
      entidades: resultadoFinal.entidades,
      usuarios: resultadoFinal.usuarios,
    },
    error: allSuccess ? undefined : 'Alguns módulos falharam na sincronização',
  };
  });
}


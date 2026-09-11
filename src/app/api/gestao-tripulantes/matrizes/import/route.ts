import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { podeGerenciarMatrizesTreinamento } from '@/lib/gestao-tripulantes/matriz-permissions';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const userId = payload.userId || payload.user_id || payload.id || '';
    const role = payload.role || '';

    const canManage = await podeGerenciarMatrizesTreinamento(userId, role);
    if (!canManage) {
      return NextResponse.json(
        { error: 'Acesso negado. É necessário ter perfil gestor, permissão ACL ou pertencer a setor autorizado para importar matrizes.' },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const wb = xlsx.read(buffer, { type: 'buffer' });

    // Look for standard sheets
    const sheetRegistros = wb.Sheets['Registros'] || wb.Sheets['registros'] || wb.Sheets['Requisitos'];
    const sheetMatriz = wb.Sheets['Matriz'] || wb.Sheets['matriz'] || wb.Sheets[wb.SheetNames[0]];

    if (!sheetRegistros && !sheetMatriz) {
      return NextResponse.json({
        error: 'Arquivo inválido: planilha não contém aba "Registros" ou "Matriz"',
      }, { status: 400 });
    }

    // 1. Extract metadata
    let codigo = (formData.get('codigo') as string)?.trim() || '';
    let nome = (formData.get('nome') as string)?.trim() || '';
    let centroResultado = (formData.get('centro_resultado') as string)?.trim() || '';
    let cliente = (formData.get('cliente') as string)?.trim() || '';
    let contrato = (formData.get('contrato') as string)?.trim() || '';
    let responsavel = (formData.get('responsavel') as string)?.trim() || '';

    if (sheetMatriz) {
      const matrizRows = xlsx.utils.sheet_to_json<any[]>(sheetMatriz, { header: 1 });
      for (let r = 0; r < Math.min(10, matrizRows.length); r++) {
        const row = matrizRows[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (!codigo && val === 'Código da Matriz:' && row[c + 1]) codigo = String(row[c + 1]).trim();
          if (!nome && val === 'Nome da Matriz:' && row[c + 1]) nome = String(row[c + 1]).trim();
          if (!centroResultado && val === 'Centro de Resultado:' && row[c + 1]) centroResultado = String(row[c + 1]).trim();
          if (!cliente && val === 'Cliente:' && row[c + 1]) cliente = String(row[c + 1]).trim();
          if (!contrato && val === 'Contrato Nº/Nome:' && row[c + 1]) contrato = String(row[c + 1]).trim();
          if (!responsavel && val === 'Responsável pela Matriz:' && row[c + 1]) responsavel = String(row[c + 1]).trim();
        }
      }
    }

    if (!nome) {
      nome = file.name.replace(/\.[^/.]+$/, '').replace(/Matriz\s*-\s*/i, '').trim() || 'Matriz de Treinamentos';
    }
    if (!codigo) {
      codigo = nome.slice(0, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    }

    // 2. Check or create matrix in gt_matrizes_treinamento
    const { data: existingMatrix } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .select('*')
      .or(`codigo.eq."${codigo}",nome.eq."${nome}"`)
      .maybeSingle();

    let matrixId = existingMatrix?.id;

    if (!matrixId) {
      const { data: newMatrix, error: insErr } = await supabaseAdmin
        .from('gt_matrizes_treinamento')
        .insert({
          codigo,
          nome,
          centro_resultado: centroResultado || null,
          cliente: cliente || null,
          contrato: contrato || null,
          responsavel: responsavel || null,
          ativo: true,
        })
        .select('*')
        .single();

      if (insErr || !newMatrix) {
        return NextResponse.json({ error: 'Erro ao criar registro da matriz: ' + insErr?.message }, { status: 500 });
      }
      matrixId = newMatrix.id;
    } else {
      // Update metadata
      await supabaseAdmin
        .from('gt_matrizes_treinamento')
        .update({
          nome,
          centro_resultado: centroResultado || existingMatrix.centro_resultado,
          cliente: cliente || existingMatrix.cliente,
          contrato: contrato || existingMatrix.contrato,
          responsavel: responsavel || existingMatrix.responsavel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', matrixId);
    }

    // 3. Map available cargos for foreign keys
    const { data: allCargos } = await supabaseAdmin.from('gt_cargos').select('id, nome');
    const cargoMap = new Map<string, string>();
    (allCargos || []).forEach(c => {
      cargoMap.set(c.nome.trim().toUpperCase(), c.id);
    });

    // 4. Parse requirements from Registros sheet
    const rawRegistros = sheetRegistros
      ? xlsx.utils.sheet_to_json<any>(sheetRegistros)
      : [];

    let importedRequirements = 0;
    const requirementsToUpsert: any[] = [];

    for (const reg of rawRegistros) {
      const funcao = String(reg['Função'] || reg['Funcao'] || reg['Cargo'] || '').trim();
      const regime = String(reg['Regime'] || 'Geral').trim();
      const treinamento = String(reg['Treinamento'] || reg['Curso'] || reg['Nome'] || '').trim();
      const especialidade = String(reg['Especialidade'] || 'ND').trim();

      if (!funcao || !treinamento) continue;

      const cargoId = cargoMap.get(funcao.toUpperCase()) || null;

      requirementsToUpsert.push({
        matriz_id: matrixId,
        cargo_id: cargoId,
        cargo_nome: funcao,
        regime,
        treinamento_nome: treinamento,
        especialidade,
        obrigatorio: true,
      });
    }

    // If Registros sheet was empty, see if we can parse columns from sheet Matriz header!
    if (requirementsToUpsert.length === 0 && sheetMatriz) {
      const matrizRows = xlsx.utils.sheet_to_json<any[]>(sheetMatriz, { header: 1 });
      // Find header row (e.g. contains 'Função' or 'Nome Completo')
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(20, matrizRows.length); r++) {
        const row = matrizRows[r];
        if (Array.isArray(row) && row.some(cell => String(cell).toLowerCase().includes('função') || String(cell).toLowerCase().includes('nome completo'))) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx >= 0) {
        const headerRow = matrizRows[headerRowIdx];
        const fixedCols = ['id', 'matrícula', 'matricula', 'nome completo', 'nome', 'função', 'funcao', 'cargo', 'centro de custo', 'regime', 'especialidade'];
        const trainingColumns: string[] = [];

        headerRow.forEach((colName: any) => {
          const c = String(colName || '').trim();
          if (c && !fixedCols.includes(c.toLowerCase())) {
            trainingColumns.push(c);
          }
        });

        // Scan rows for Funções
        const funcoesFound = new Set<string>();
        for (let r = headerRowIdx + 1; r < matrizRows.length; r++) {
          const row = matrizRows[r];
          if (!Array.isArray(row)) continue;
          const funcao = String(row[3] || '').trim(); // col 3 is usually Função
          if (funcao && funcao !== 'ND' && funcao.length > 2) {
            funcoesFound.add(funcao);
          }
        }

        for (const f of funcoesFound) {
          const cargoId = cargoMap.get(f.toUpperCase()) || null;
          for (const t of trainingColumns) {
            requirementsToUpsert.push({
              matriz_id: matrixId,
              cargo_id: cargoId,
              cargo_nome: f,
              regime: 'Geral',
              treinamento_nome: t,
              especialidade: 'ND',
              obrigatorio: true,
            });
          }
        }
      }
    }

    // Insert requirements
    if (requirementsToUpsert.length > 0) {
      for (const req of requirementsToUpsert) {
        const { data: existing } = await supabaseAdmin
          .from('gt_matriz_treinamento_requisitos')
          .select('id')
          .eq('matriz_id', req.matriz_id)
          .eq('cargo_nome', req.cargo_nome)
          .eq('regime', req.regime)
          .eq('treinamento_nome', req.treinamento_nome)
          .maybeSingle();

        if (!existing) {
          await supabaseAdmin.from('gt_matriz_treinamento_requisitos').insert(req);
          importedRequirements++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        matriz_id: matrixId,
        codigo,
        nome,
        cliente,
        contrato,
        total_requisitos_importados: importedRequirements,
        total_processados: requirementsToUpsert.length,
      },
      message: `Matriz ${nome} processada com sucesso! ${importedRequirements} novos requisitos cadastrados.`
    });
  } catch (error) {
    console.error('Erro ao importar matriz de treinamento:', error);
    return NextResponse.json({ error: 'Erro interno ao importar planilha: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

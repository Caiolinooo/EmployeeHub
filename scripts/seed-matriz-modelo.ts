import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { supabaseAdmin } from '../src/lib/supabase';
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

async function seed() {
  const filePath = 'C:\\Users\\caio.correia\\Downloads\\Matriz - Modelo 002_usr_4753 (1).xlsx';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const wb = xlsx.readFile(filePath);
  const sheetMatriz = wb.Sheets['Matriz'];
  const sheetRegistros = wb.Sheets['Registros'];

  if (!sheetRegistros) {
    console.error('Sheet Registros not found in file');
    process.exit(1);
  }

  // Parse header metadata from sheet Matriz
  const matrizRows = xlsx.utils.sheet_to_json<any[]>(sheetMatriz, { header: 1 });
  // Row index 2: [ null, null, 'Código da Matriz:', 'CASTORONE', 'Nome da Matriz:', 'CASTORONE', null, null, null, 'Ativo?:', 'Sim' ]
  // Row index 3: [ null, null, 'Centro de Resultado:', 'CASTORONE - L.M (3)', 'Cliente:', 'LUZ MARÍTIMA', ... 'Contrato Nº/Nome:', 'CASTORONE - L.M (3)' ]
  // Row index 4: [ null, null, 'Descrição da Matriz:', null, ..., 'Responsável pela Matriz:', 'JANAINA' ]

  let codigo = 'CASTORONE';
  let nome = 'CASTORONE';
  let centroResultado = 'CASTORONE - L.M (3)';
  let cliente = 'LUZ MARÍTIMA';
  let contrato = 'CASTORONE - L.M (3)';
  let responsavel = 'JANAINA';

  try {
    for (let r = 0; r < Math.min(10, matrizRows.length); r++) {
      const row = matrizRows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (val === 'Código da Matriz:' && row[c + 1]) codigo = String(row[c + 1]).trim();
        if (val === 'Nome da Matriz:' && row[c + 1]) nome = String(row[c + 1]).trim();
        if (val === 'Centro de Resultado:' && row[c + 1]) centroResultado = String(row[c + 1]).trim();
        if (val === 'Cliente:' && row[c + 1]) cliente = String(row[c + 1]).trim();
        if (val === 'Contrato Nº/Nome:' && row[c + 1]) contrato = String(row[c + 1]).trim();
        if (val === 'Responsável pela Matriz:' && row[c + 1]) responsavel = String(row[c + 1]).trim();
      }
    }
  } catch (err) {
    console.warn('Could not parse all metadata, using defaults', err);
  }

  console.log('Seeding Matrix:', { codigo, nome, centroResultado, cliente, contrato, responsavel });

  // 1. Check or insert gt_matrizes_treinamento
  const { data: existingMatrix } = await supabaseAdmin
    .from('gt_matrizes_treinamento')
    .select('*')
    .eq('codigo', codigo)
    .maybeSingle();

  let matrixId = existingMatrix?.id;

  if (!matrixId) {
    const { data: newMatrix, error: insertErr } = await supabaseAdmin
      .from('gt_matrizes_treinamento')
      .insert({
        codigo,
        nome,
        centro_resultado: centroResultado,
        cliente,
        contrato,
        responsavel,
        ativo: true,
      })
      .select('id')
      .single();

    if (insertErr || !newMatrix) {
      console.error('Error creating matrix:', insertErr);
      process.exit(1);
    }
    matrixId = newMatrix.id;
    console.log('Created matrix with ID:', matrixId);
  } else {
    console.log('Using existing matrix with ID:', matrixId);
  }

  // 2. Fetch existing cargos for foreign key association if matching
  const { data: allCargos } = await supabaseAdmin
    .from('gt_cargos')
    .select('id, nome');
  const cargoMap = new Map<string, string>();
  (allCargos || []).forEach(c => {
    cargoMap.set(c.nome.trim().toUpperCase(), c.id);
  });

  // 3. Parse Registros
  const registros = xlsx.utils.sheet_to_json<any>(sheetRegistros);
  console.log(`Found ${registros.length} requirements in sheet Registros`);

  let insertedCount = 0;
  for (const reg of registros) {
    const funcao = String(reg['Função'] || '').trim();
    const regime = String(reg['Regime'] || 'Geral').trim();
    const treinamento = String(reg['Treinamento'] || '').trim();
    const especialidade = String(reg['Especialidade'] || 'ND').trim();

    if (!funcao || !treinamento) continue;

    const cargoId = cargoMap.get(funcao.toUpperCase()) || null;

    // Check if already exists for this matrix
    const { data: existingReq } = await supabaseAdmin
      .from('gt_matriz_treinamento_requisitos')
      .select('id')
      .eq('matriz_id', matrixId)
      .eq('cargo_nome', funcao)
      .eq('regime', regime)
      .eq('treinamento_nome', treinamento)
      .maybeSingle();

    if (!existingReq) {
      const { error: reqErr } = await supabaseAdmin
        .from('gt_matriz_treinamento_requisitos')
        .insert({
          matriz_id: matrixId,
          cargo_id: cargoId,
          cargo_nome: funcao,
          regime,
          treinamento_nome: treinamento,
          obrigatorio: true,
          especialidade,
        });

      if (reqErr) {
        console.error('Error inserting requirement:', reqErr.message);
      } else {
        insertedCount++;
      }
    }
  }

  console.log(`Seeding complete! ${insertedCount} new requirements inserted into matrix.`);
}

seed().catch(err => {
  console.error('Seed fatal error:', err);
  process.exit(1);
});

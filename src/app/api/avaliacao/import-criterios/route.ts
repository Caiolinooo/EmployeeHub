import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminFromRequest } from '@/lib/auth';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

/**
 * API endpoint to import evaluation criteria from Excel file
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Get the file path from the request body or use the default path
    const { filePath } = await request.json();
    
    // Default path is in the docs folder
    const excelFilePath = filePath || path.join(process.cwd(), 'docs', 'AN-TED-002-R0 - Avaliação de Desempenho.xlsx');
    
    // Check if file exists
    if (!fs.existsSync(excelFilePath)) {
      return NextResponse.json(
        { success: false, error: `File not found: ${excelFilePath}` },
        { status: 404 }
      );
    }

    console.log(`Reading Excel file: ${excelFilePath}`);
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelFilePath);
    
    // Get the sheet that contains the criteria (assuming it's the first one)
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${data.length} records in the spreadsheet`);
    
    // Filter and map only relevant data for criteria
    const criterios = data
      .filter((row: any) => row.Nome && row.Categoria) // Filter rows that have name and category
      .map((row: any) => ({
        nome: row.Nome || row.NOME || row.nome || row.Critério || row.CRITÉRIO || row.critério || '',
        descricao: row.Descricao || row.DESCRICAO || row.descricao || row.Descrição || row.DESCRIÇÃO || row.descrição || '',
        categoria: row.Categoria || row.CATEGORIA || row.categoria || '',
        peso: parseFloat(row.Peso || row.PESO || row.peso || 1.0) || 1.0,
        pontuacao_maxima: parseInt(row.Pontuacao_Maxima || row.PONTUACAO_MAXIMA || row.pontuacao_maxima || 
                                  row['Pontuação Máxima'] || row['PONTUAÇÃO MÁXIMA'] || row['pontuação máxima'] || 5) || 5,
        ativo: true
      }));
    
    let processedCriterios = criterios;
    
    if (criterios.length === 0) {
      console.log('No valid criteria found in the spreadsheet. Trying alternative format...');
      
      // Try an alternative format (may need to be adjusted based on the actual file format)
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
      
      // Look for headers
      let headerRow = -1;
      const headers: Record<string, string> = {};
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as Record<string, any>;
        // Check if this row looks like a header
        if (Object.values(row).some(val => 
          typeof val === 'string' && 
          (val.toLowerCase().includes('nome') || 
           val.toLowerCase().includes('critério') || 
           val.toLowerCase().includes('categoria')))) {
          
          headerRow = i;
          
          // Map headers
          Object.entries(row).forEach(([col, val]) => {
            if (typeof val === 'string') {
              const valLower = val.toLowerCase();
              if (valLower.includes('nome') || valLower.includes('critério')) headers.nome = col;
              else if (valLower.includes('desc')) headers.descricao = col;
              else if (valLower.includes('categ')) headers.categoria = col;
              else if (valLower.includes('peso')) headers.peso = col;
              else if (valLower.includes('pont') || valLower.includes('max')) headers.pontuacao_maxima = col;
            }
          });
          
          break;
        }
      }
      
      if (headerRow >= 0 && Object.keys(headers).length >= 2) {
        console.log(`Headers found on line ${headerRow + 1}:`, headers);
        
        // Extract data based on found headers
        const dataCriterios = [];
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i] as Record<string, any>;
          if (row[headers.nome] && (headers.categoria ? row[headers.categoria] : true)) {
            dataCriterios.push({
              nome: row[headers.nome] || '',
              descricao: headers.descricao ? (row[headers.descricao] || '') : '',
              categoria: headers.categoria ? (row[headers.categoria] || 'Geral') : 'Geral',
              peso: headers.peso ? (parseFloat(row[headers.peso]) || 1.0) : 1.0,
              pontuacao_maxima: headers.pontuacao_maxima ? (parseInt(row[headers.pontuacao_maxima]) || 5) : 5,
              ativo: true
            });
          }
        }
        
        if (dataCriterios.length > 0) {
          console.log(`Found ${dataCriterios.length} criteria in alternative format`);
          processedCriterios = dataCriterios;
        }
      }
    }
    
    if (processedCriterios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid criteria found in the Excel file' },
        { status: 400 }
      );
    }
    
    console.log(`Processed ${processedCriterios.length} criteria for import`);
    
    // Check existing criteria to avoid duplicates
    const { data: existingCriterios, error: existingError } = await supabaseAdmin
      .from('criterios')
      .select('nome')
      .is('deleted_at', null);
    
    if (existingError) {
      console.error('Error checking existing criteria:', existingError);
      return NextResponse.json(
        { success: false, error: `Error checking existing criteria: ${existingError.message}` },
        { status: 500 }
      );
    }
    
    const existingNames = new Set((existingCriterios || []).map(c => c.nome.toLowerCase()));
    
    // Filter only criteria that don't exist
    const criteriosToInsert = processedCriterios.filter(c => !existingNames.has(c.nome.toLowerCase()));
    
    if (criteriosToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All criteria already exist in the database',
        imported: 0,
        total: processedCriterios.length
      });
    }
    
    console.log(`Inserting ${criteriosToInsert.length} new criteria...`);
    
    // Insert criteria into the database
    const { data: insertedData, error: insertError } = await supabaseAdmin
      .from('criterios')
      .insert(criteriosToInsert)
      .select();
    
    if (insertError) {
      console.error('Error inserting criteria:', insertError);
      return NextResponse.json(
        { success: false, error: `Error inserting criteria: ${insertError.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `${insertedData?.length || 0} criteria imported successfully`,
      imported: insertedData?.length || 0,
      total: processedCriterios.length,
      criteria: insertedData
    });
    
  } catch (error) {
    console.error('Error during import:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

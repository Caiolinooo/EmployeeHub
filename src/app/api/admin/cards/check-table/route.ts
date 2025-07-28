import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { isAdminFromRequest } from '@/lib/auth';
import dashboardCards from '@/data/cards';

// GET - Verificar se a tabela cards existe
export async function GET(request: NextRequest) {
  try {
    // Verificar se o usuário é administrador
    const adminCheck = await isAdminFromRequest(request);
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso não autorizado' },
        { status: 403 }
      );
    }

    console.log('Verificando se a tabela cards existe...');

    try {
      // Verificar se a tabela cards existe
      const { data, error } = await supabaseAdmin
        .from('cards')
        .select('id')
        .limit(1);

      if (error) {
        console.error('Erro ao verificar tabela cards:', error);

        // Se o erro for relacionado à tabela não existir
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log('Tabela cards não existe, verificando se há cards hardcoded...');

          // Verificar se temos cards hardcoded
          if (dashboardCards && dashboardCards.length > 0) {
            console.log(`Encontrados ${dashboardCards.length} cards hardcoded`);

            // Retornar que a tabela existe (mesmo que seja virtual)
            return NextResponse.json({
              success: true,
              exists: true,
              tableExists: false,
              supabaseCount: 0,
              hardcodedCount: dashboardCards.length,
              count: dashboardCards.length,
              source: 'hardcoded',
              message: 'Usando cards hardcoded'
            });
          }

          return NextResponse.json({
            success: false,
            exists: false,
            tableExists: false,
            supabaseCount: 0,
            hardcodedCount: 0,
            error: 'A tabela cards não existe'
          });
        }

        return NextResponse.json(
          { success: false, error: `Erro ao verificar tabela: ${error.message}` },
          { status: 500 }
        );
      }

      console.log(`Tabela cards existe, encontrados ${data?.length || 0} cards`);

      // Contar registros totais
      const { count, error: countError } = await supabaseAdmin
        .from('cards')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        success: true,
        exists: true,
        tableExists: true,
        supabaseCount: count || 0,
        hardcodedCount: 0,
        count: count || 0,
        source: 'database'
      });
    } catch (err) {
      console.error('Erro ao verificar tabela cards:', err);

      // Verificar se temos cards hardcoded como fallback
      if (dashboardCards && dashboardCards.length > 0) {
        console.log(`Usando fallback: Encontrados ${dashboardCards.length} cards hardcoded`);

        return NextResponse.json({
          success: true,
          exists: true,
          count: dashboardCards.length,
          source: 'hardcoded',
          message: 'Usando cards hardcoded (fallback)'
        });
      }

      throw err;
    }
  } catch (error) {
    console.error('Erro ao verificar tabela cards:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor', details: String(error) },
      { status: 500 }
    );
  }
}

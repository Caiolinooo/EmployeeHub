import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase';

// GET /api/avaliacao/criterios -> lista critérios ativos
export async function GET() {
  try {
    console.log('🔍 Buscando critérios de avaliação...');
    
    const supabase = await getSupabaseAdminClient();
    
    const { data, error } = await supabase
      .from('criterios_avaliacao')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });
    
    if (error) {
      console.error('❌ Erro ao buscar critérios:', error);
      throw error;
    }
    
    console.log(`✅ ${data?.length || 0} critérios encontrados`);
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('❌ Erro no endpoint /api/avaliacao/criterios:', e);
    return NextResponse.json({ 
      success: false, 
      error: e.message || 'Erro ao buscar critérios', 
      timestamp: new Date().toISOString() 
    }, { status: 500 });
  }
}

// POST /api/avaliacao/criterios -> criar novo critério
export async function POST(request: Request) {
  try {
    console.log('📝 Criando novo critério de avaliação...');
    
    const body = await request.json();
    const { nome, descricao, categoria, tipo = 'gerente', apenas_lideres = false, ordem = 0, peso = 1 } = body;
    
    if (!nome) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nome obrigatório', 
        timestamp: new Date().toISOString() 
      }, { status: 400 });
    }
    
    const supabase = await getSupabaseAdminClient();
    const insertData: any = { nome, descricao, categoria, tipo, apenas_lideres, ordem, peso };
    
    const { data, error } = await supabase
      .from('criterios_avaliacao')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar critério:', error);
      throw error;
    }
    
    console.log('✅ Critério criado:', data.nome);
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (e: any) {
    console.error('❌ Erro no POST /api/avaliacao/criterios:', e);
    return NextResponse.json({ 
      success: false, 
      error: e.message || 'Erro ao criar critério', 
      timestamp: new Date().toISOString() 
    }, { status: 500 });
  }
}

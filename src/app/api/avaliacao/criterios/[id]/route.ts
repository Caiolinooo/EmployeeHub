import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PATCH /api/avaliacao/criterios/:id
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json();
    const update: any = {};
    ['nome','descricao','categoria','tipo','apenas_lideres','ordem','peso','ativo'].forEach(key => {
      if (body[key] !== undefined) update[key] = body[key];
    });
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum campo para atualizar', timestamp: new Date().toISOString() }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('criterios_avaliacao')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

// DELETE /api/avaliacao/criterios/:id (soft disable)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const { data, error } = await supabase
      .from('criterios_avaliacao')
      .update({ ativo: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

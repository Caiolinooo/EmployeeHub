import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// PUT: update afastamento
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'tipo_afastamento', 'cod_mot_afast', 'motivo', 'cid',
      'data_inicio', 'data_fim', 'data_prevista_retorno', 'observacoes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('gt_afastamentos')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ afastamento: data });
  } catch (err: any) {
    console.error('[afastamentos] PUT error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE: soft-delete afastamento
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('gt_afastamentos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[afastamentos] DELETE error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

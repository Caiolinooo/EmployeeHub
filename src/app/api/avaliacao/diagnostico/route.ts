import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: sample } = await supabaseAdmin
      .from('avaliacoes_desempenho')
      .select('*')
      .limit(1)
      .single();

    const hasRespostas = sample && 'respostas' in sample;

    return NextResponse.json({
      success: true,
      hasRespostasColumn: hasRespostas,
      sampleKeys: sample ? Object.keys(sample) : [],
      needsMigration: !hasRespostas,
      sql: `ALTER TABLE avaliacoes_desempenho ADD COLUMN IF NOT EXISTS respostas JSONB DEFAULT '{}'::jsonb;`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

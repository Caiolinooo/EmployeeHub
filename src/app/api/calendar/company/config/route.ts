import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Public config for calendar UI (no auth)
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'company_calendar')
      .maybeSingle();
    const v = (data as any)?.value || {};
    const markerColor = typeof v.marker_color === 'string' ? v.marker_color : '#6339F5';
    return NextResponse.json({ markerColor });
  } catch (e) {
    return NextResponse.json({ markerColor: '#6339F5' });
  }
}


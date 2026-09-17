import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTokenFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // Beacon envia como text/plain as vezes, precisamos lidar com isso
        // Mas enviamos blob type application/json no componente
        let body;
        try {
            const text = await request.text();
            body = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const { postId, duration } = body;
        let { userId } = body;

        // Fallback: Tentar obter usuário do token se não vier no body (correção do problema de anônimos)
        if (!userId) {
            const authResult = await verifyTokenFromRequest(request);
            if (authResult.valid && authResult.userId) {
                userId = authResult.userId;
            }
        }

        // CRITICAL FIX: Do not track anonymous users
        if (!userId) {
            // console.log('⚠️ Ignoring anonymous tracking request');
            return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
        }

        console.log(`⏱️ Tracking Time: Post ${postId}, User ${userId}, Duration: ${duration}s`);

        if (!postId || !duration) {
            console.log('⚠️ Missing postId or duration, skipping');
            return NextResponse.json({ success: false });
        }

        // Atualizar ou inserir. 
        // Estratégia: Inserir log novo ou somar ao existente do dia?
        // Para analytics preciso, melhor logs granulares, mas para MVP vamos somar na view de hoje.

        const today = new Date().toISOString().split('T')[0];

        // Tentar atualizar view existente do dia
        const { data: existing, error } = await supabaseAdmin
            .from('news_post_views')
            .select('id, duration_seconds')
            .eq('post_id', postId)
            .eq('user_id', userId) // Se user logado
            .gte('viewed_at', `${today}T00:00:00.000Z`)
            .limit(1)
            .single();

        if (existing) {
            const newDuration = (existing.duration_seconds || 0) + duration;
            const { error: updateError } = await supabaseAdmin
                .from('news_post_views')
                .update({ duration_seconds: newDuration })
                .eq('id', existing.id);
            console.log(`✅ Updated existing view: ${existing.id}, new duration: ${newDuration}s, error: ${updateError?.message || 'none'}`);
        } else {
            // Se não achou view (ex: view tracker disparou mas o view inicial 5s falhou ou foi outra sessão)
            // Cria novo registro
            const { error: insertError } = await supabaseAdmin.from('news_post_views').insert({
                post_id: postId,
                user_id: userId,
                duration_seconds: duration,
                viewed_at: new Date().toISOString()
            });
            console.log(`✅ Inserted new view for post ${postId}, duration: ${duration}s, error: ${insertError?.message || 'none'}`);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Time tracking error:', error);
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}

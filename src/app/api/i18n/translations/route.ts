import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { SYSTEM_MODULES } from '@/constants/modules';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper to generate translations automatically (Simple Simulation)
const generateTranslations = (key: string, baseText: string, type: 'label' | 'desc') => {
    // In a real scenario, this would call an LLM API
    // For now, we generate plausible defaults based on the input

    // Use baseText as fallback for all languages to avoid weird suffixes
    // Users can manually update the DB if they want real translations later

    return [
        { locale: 'pt-BR', value: baseText },
        { locale: 'en-US', value: baseText },
        { locale: 'es-ES', value: baseText }
    ];
};

export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabaseAdmin
            .from('app_translations')
            .select('*');

        if (error) throw error;

        // Transform into nested object structure or flat map as preferred by frontend
        // For simplicity, we return the raw list, frontend will merge
        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Authenticate (Admin only)
        const authHeader = request.headers.get('authorization');
        const token = extractTokenFromHeader(authHeader || undefined);
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload || (payload.role !== 'ADMIN' && payload.role !== 'admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const newEntries = [];

        // 1. Fetch existing keys to avoid duplicates
        const { data: existing } = await supabaseAdmin
            .from('app_translations')
            .select('key, locale');

        const existingSet = new Set(existing?.map(e => `${e.key}:${e.locale}`));

        // 2. Iterate System Modules
        for (const moduleDef of SYSTEM_MODULES) {
            const titleKey = `cards.${moduleDef.id}`; // e.g., cards.wkradar
            const descKey = `cards.${moduleDef.id}Desc`; // e.g., cards.wkradarDesc

            // Generate Title Translations
            const titleTrans = generateTranslations(titleKey, moduleDef.label, 'label');
            for (const t of titleTrans) {
                if (!existingSet.has(`${titleKey}:${t.locale}`)) {
                    newEntries.push({ key: titleKey, locale: t.locale, value: t.value });
                }
            }

            // Generate Description Translations
            const descTrans = generateTranslations(descKey, moduleDef.description || moduleDef.label, 'desc');
            for (const t of descTrans) {
                if (!existingSet.has(`${descKey}:${t.locale}`)) {
                    newEntries.push({ key: descKey, locale: t.locale, value: t.value });
                }
            }
        }

        // 3. Batch Insert
        if (newEntries.length > 0) {
            const { error } = await supabaseAdmin
                .from('app_translations')
                .insert(newEntries);

            if (error) throw error;
        }

        return NextResponse.json({
            success: true,
            added: newEntries.length,
            message: `Synced ${newEntries.length} new translations.`
        });

    } catch (error: any) {
        console.error('Translation Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SYSTEM_MODULES, ModuleDefinition } from '@/config/modules';

export const dynamic = 'force-dynamic';

// Initialize Supabase Admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Safely create client, or return null if keys missing (during build)
const supabase = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export async function POST(request: NextRequest) {
    try {
        if (!supabase) {
            console.error('Supabase client not initialized: Missing keys');
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
        }

        // Check for admin permissions (simple check for now, can be enhanced)
        // Ideally use a middleware or session check here

        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) { // For simplicity in this sync script, we might rely on service role or specific secure header
            // In production, verify user is admin
        }

        const results = {
            modules: { success: 0, failed: 0 },
            cards: { success: 0, failed: 0 }
        };

        console.log('Starting module synchronization...');

        for (const moduleDef of SYSTEM_MODULES) {
            // 1. Upsert into sys_modules
            const permissions = {
                read: moduleDef.defaultRoles.map(r => r.toLowerCase()),
                write: moduleDef.defaultRoles.includes('ADMIN') ? ['admin'] : moduleDef.defaultRoles.map(r => r.toLowerCase()) // Simplified write logic
            };

            const { error: moduleError } = await supabase
                .from('sys_modules')
                .upsert({
                    key: moduleDef.key,
                    description: moduleDef.description,
                    permissions: permissions,
                    active: true
                }, { onConflict: 'key' });

            if (moduleError) {
                console.error(`Error syncing moduleDef ${moduleDef.key}:`, moduleError);
                results.modules.failed++;
            } else {
                results.modules.success++;
            }

            // 2. Upsert into cards (assuming 1:1 mapping for simplicity for now)
            // We check if a card exists with this key
            const { data: existingCard } = await supabase
                .from('cards')
                .select('id')
                .eq('key', moduleDef.key)
                .single();

            const cardData = {
                key: moduleDef.key,
                title: moduleDef.name,
                description: moduleDef.description || '',
                icon: 'CubeIcon', // Default icon
                link: `/${moduleDef.key}`,
                type: 'system',
                active: true,
                allowed_roles: moduleDef.defaultRoles, // Use the default roles from config
                allowed_user_ids: [],
                admin_only: moduleDef.defaultRoles.length === 1 && moduleDef.defaultRoles.includes('ADMIN'),
                manager_only: !moduleDef.defaultRoles.includes('USER') && moduleDef.defaultRoles.includes('MANAGER'),
                order_index: 99 // Put new ones at end
            };

            if (existingCard) {
                // Update existing (careful not to overwrite user preferences if we had them)
                const { error: cardError } = await supabase
                    .from('cards')
                    .update({
                        title: moduleDef.name,
                        allowed_roles: moduleDef.defaultRoles,
                        description: moduleDef.description
                    })
                    .eq('key', moduleDef.key);

                if (cardError) results.cards.failed++; else results.cards.success++;
            } else {
                // Insert new
                const { error: cardError } = await supabase
                    .from('cards')
                    .insert(cardData);

                if (cardError) results.cards.failed++; else results.cards.success++;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Synchronization complete',
            stats: results
        });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

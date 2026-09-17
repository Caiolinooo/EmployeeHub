import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPermission } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics/modules
 * Returns module access statistics for the engagement dashboard
 * Admin only endpoint
 */
export const GET = withPermission('admin', async (request: NextRequest) => {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get module access stats aggregated
        const { data: moduleStats, error: statsError } = await supabaseAdmin
            .from('module_access')
            .select('module_id, module_name, user_id, user_email, duration_seconds, accessed_at')
            .gte('accessed_at', startDate.toISOString())
            .order('accessed_at', { ascending: false });

        if (statsError) {
            // Table might not exist yet
            if (statsError.code === '42P01') {
                return NextResponse.json({
                    modules: [],
                    summary: { total_accesses: 0, unique_users: 0, unique_modules: 0 },
                    warning: 'module_access table does not exist yet'
                });
            }
            throw statsError;
        }

        // Aggregate data
        const moduleMap = new Map<string, {
            module_id: string;
            module_name: string;
            total_accesses: number;
            unique_users: Set<string>;
            total_duration: number;
            last_accessed: string;
            users: Map<string, { count: number; duration: number; email: string | null }>;
        }>();

        const allUsers = new Set<string>();

        (moduleStats || []).forEach((access: any) => {
            const key = access.module_id;
            if (!moduleMap.has(key)) {
                moduleMap.set(key, {
                    module_id: access.module_id,
                    module_name: access.module_name,
                    total_accesses: 0,
                    unique_users: new Set(),
                    total_duration: 0,
                    last_accessed: access.accessed_at,
                    users: new Map()
                });
            }

            const mod = moduleMap.get(key)!;
            mod.total_accesses++;
            mod.total_duration += access.duration_seconds || 0;

            if (access.user_id) {
                mod.unique_users.add(access.user_id);
                allUsers.add(access.user_id);

                const userStats = mod.users.get(access.user_id) || { count: 0, duration: 0, email: null };
                userStats.count++;
                userStats.duration += access.duration_seconds || 0;
                // Store email if we have it
                if (access.user_email) {
                    userStats.email = access.user_email;
                }
                mod.users.set(access.user_id, userStats);
            }
        });

        // Convert to array and sort by total accesses
        const modules = Array.from(moduleMap.values())
            .map(mod => ({
                module_id: mod.module_id,
                module_name: mod.module_name,
                total_accesses: mod.total_accesses,
                unique_users: mod.unique_users.size,
                avg_duration: mod.total_accesses > 0 ? mod.total_duration / mod.total_accesses : 0,
                last_accessed: mod.last_accessed,
                top_users: Array.from(mod.users.entries())
                    .sort((a, b) => b[1].duration - a[1].duration) // Sort by duration
                    .slice(0, 10) // Increased to top 10
                    .map(([userId, stats]) => ({
                        user_id: userId,
                        user_email: stats.email,
                        access_count: stats.count,
                        total_duration: stats.duration
                    }))
            }))
            .sort((a, b) => b.total_accesses - a.total_accesses);

        // Get hourly pattern
        const hourlyPattern: Record<number, number> = {};
        (moduleStats || []).forEach((access: any) => {
            const hour = new Date(access.accessed_at).getHours();
            hourlyPattern[hour] = (hourlyPattern[hour] || 0) + 1;
        });

        // Get daily pattern
        const dailyPattern: Record<number, number> = {};
        (moduleStats || []).forEach((access: any) => {
            const day = new Date(access.accessed_at).getDay();
            dailyPattern[day] = (dailyPattern[day] || 0) + 1;
        });

        // Fetch user details for top users using IDs stored in module_access
        // Collect all unique user IDs from the records
        const topUserIds = [...new Set(
            modules.flatMap(m => m.top_users.map(u => u.user_id)).filter(Boolean)
        )];
        const userDetails: Record<string, any> = {};

        try {
            // Lookup users by ID directly in the users table
            // Using specific columns that are known to exist from the viewers API
            const { data: users, error: userError } = await supabaseAdmin
                .from('users_unified')
                .select('id, first_name, last_name, email, role, drive_photo_url, avatar')
                .in('id', topUserIds);

            if (users && users.length > 0) {
                // Create ID -> user details map
                users.forEach((u: any) => {
                    // Construct name exactly like the Viewers API does
                    const firstName = u.first_name || '';
                    const lastName = u.last_name || '';
                    let fullName = `${firstName} ${lastName}`.trim();

                    if (!fullName) {
                        fullName = u.email?.split('@')[0] || 'Usuário';
                    }

                    // Prioritize drive_photo_url, fallback to avatar
                    const avatar = u.drive_photo_url || u.avatar || null;

                    userDetails[u.id] = {
                        name: fullName,
                        email: u.email,
                        avatar: avatar
                    };
                });
            } else {
                console.log('⚠️ No users found for IDs:', topUserIds);
            }
        } catch (e: any) {
            console.error('Error fetching user details:', e.message);
        }

        // Enrich modules with user details
        const enrichedModules = modules.map(mod => ({
            ...mod,
            top_users: mod.top_users.map(u => ({
                ...u,
                ...(userDetails[u.user_id] || {})
            }))
        }));

        return NextResponse.json({
            modules: enrichedModules,
            summary: {
                total_accesses: moduleStats?.length || 0,
                unique_users: allUsers.size,
                unique_modules: modules.length
            },
            patterns: {
                hourly: hourlyPattern,
                daily: dailyPattern
            },
            period: {
                days,
                start: startDate.toISOString(),
                end: new Date().toISOString()
            }
        });

    } catch (e: any) {
        console.error('Module Metrics API Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
});

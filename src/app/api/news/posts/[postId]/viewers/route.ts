import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isAdminFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/news/posts/[postId]/viewers
 * Returns list of users who viewed this post with their details
 * Admin only endpoint
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ postId: string }> }
) {
    try {
        // Verify admin access
        const adminCheck = await isAdminFromRequest(request);
        if (!adminCheck.isAdmin) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 403 }
            );
        }

        const { postId } = await params;
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        // Query news_post_views joined with users table to get viewer details
        // First try news_post_views (session-based with duration)
        const { data: sessionViews, error: sessionError } = await supabaseAdmin
            .from('news_post_views')
            .select(`
                id,
                user_id,
                session_id,
                viewed_at,
                duration_seconds
            `)
            .eq('post_id', postId)
            .order('viewed_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (sessionError) {
            console.warn('news_post_views query failed, trying news_views:', sessionError);
        }

        // Also try news_views (user-based unique views)
        const { data: userViews, error: userError } = await supabaseAdmin
            .from('news_views')
            .select(`
                id,
                user_id,
                created_at
            `)
            .eq('news_id', postId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Collect unique user IDs from both sources
        const userIds = new Set<string>();
        const viewRecords: Array<{
            user_id: string | null;
            session_id?: string;
            viewed_at: string;
            duration_seconds?: number;
        }> = [];

        if (sessionViews && sessionViews.length > 0) {
            sessionViews.forEach((v: any) => {
                if (v.user_id) userIds.add(v.user_id);
                viewRecords.push({
                    user_id: v.user_id,
                    session_id: v.session_id,
                    viewed_at: v.viewed_at,
                    duration_seconds: v.duration_seconds
                });
            });
        }

        if (userViews && userViews.length > 0) {
            userViews.forEach((v: any) => {
                if (v.user_id && !userIds.has(v.user_id)) {
                    userIds.add(v.user_id);
                    viewRecords.push({
                        user_id: v.user_id,
                        viewed_at: v.created_at
                    });
                }
            });
        }

        // Fetch user details for all unique user IDs
        const users: Record<string, any> = {};
        if (userIds.size > 0) {
            const { data: userData, error: userFetchError } = await supabaseAdmin
                .from('users_unified')
                .select('id, first_name, last_name, email, role, drive_photo_url, avatar')
                .in('id', Array.from(userIds));

            if (!userFetchError && userData) {
                userData.forEach((u: any) => {
                    users[u.id] = u;
                });
            }
        }

        // Build response with user details
        const viewers = viewRecords.map(record => {
            const user = record.user_id ? users[record.user_id] : null;
            return {
                user_id: record.user_id,
                session_id: record.session_id,
                viewed_at: record.viewed_at,
                duration_seconds: record.duration_seconds || 0,
                user: user ? {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    role: user.role,
                    avatar: user.drive_photo_url || user.avatar
                } : null,
                // For anonymous sessions
                is_anonymous: !record.user_id
            };
        });

        // Get total count
        const { count: totalPostViews } = await supabaseAdmin
            .from('news_post_views')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

        const { count: totalUserViews } = await supabaseAdmin
            .from('news_views')
            .select('*', { count: 'exact', head: true })
            .eq('news_id', postId);

        // Calculate unique viewers
        const uniqueViewerIds = new Set(viewRecords.filter(r => r.user_id).map(r => r.user_id));

        return NextResponse.json({
            success: true,
            viewers,
            stats: {
                total_views: (totalPostViews || 0) + (totalUserViews || 0),
                unique_viewers: uniqueViewerIds.size,
                anonymous_views: viewRecords.filter(r => !r.user_id).length
            },
            pagination: {
                page,
                limit,
                hasMore: viewRecords.length === limit
            }
        });

    } catch (error) {
        console.error('Error fetching viewers:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch viewers' },
            { status: 500 }
        );
    }
}

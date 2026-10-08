import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermissionOrGrant } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export const DELETE = withPermissionOrGrant('admin', ['biblioteca.delete', 'biblioteca.manage'], async (request: NextRequest, user, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    try {
        // 1. Fetch item to get file paths
        const { data: item, error: fetchError } = await supabaseAdmin
            .from('library_items')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        // 2. Collect files to delete
        const filesToDelete: string[] = [];

        // Helper to extract path from URL
        const extractPath = (url: string) => {
            if (!url) return null;
            // Check if it's a Supabase Storage URL for our bucket
            if (url.includes('/storage/v1/object/public/library-assets/')) {
                return url.split('/library-assets/')[1];
            }
            return null;
        };

        // Check main content
        const mainPath = extractPath(item.content_url);
        if (mainPath) filesToDelete.push(mainPath);

        // Check collection resources
        if (item.type === 'collection' && item.metadata?.resources) {
            item.metadata.resources.forEach((res: any) => {
                if (res.type === 'file') {
                    const resPath = extractPath(res.url);
                    if (resPath) filesToDelete.push(resPath);
                }
            });
        }

        // 3. Delete files from Storage
        if (filesToDelete.length > 0) {
            const { error: storageError } = await supabaseAdmin
                .storage
                .from('library-assets')
                .remove(filesToDelete);

            if (storageError) {
                console.error('Error cleaning up storage files:', storageError);
                // We continue to delete the DB record even if storage cleanup fails
                // to prevent inconsistent state where user thinks item is deleted but it isn't.
            } else {
                console.log(`Deleted ${filesToDelete.length} files from storage for item ${id}`);
            }
        }

        // 4. Delete from Database
        const { error } = await supabaseAdmin
            .from('library_items')
            .delete() // Hard delete
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

// Optional: PUT for updates (future proofing)
export const PUT = withPermissionOrGrant('admin', ['biblioteca.update', 'biblioteca.manage'], async (request: NextRequest, user, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const json = await request.json();

    const { error } = await supabaseAdmin
        .from('library_items')
        .update(json)
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});

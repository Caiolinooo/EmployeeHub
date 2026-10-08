import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withPermissionOrGrant } from '@/lib/api-auth';

export const POST = withPermissionOrGrant('manager', ['biblioteca.upload', 'biblioteca.create'], async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { fileName, folder } = body;

        if (!fileName) {
            return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
        }

        // Ensure folder is safe or allowed
        const validFolders = ['', 'collection_resources'];
        const targetFolder = folder && validFolders.includes(folder) ? folder : '';

        const filePath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

        const supabaseAdmin = await getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
            .storage
            .from('library-assets')
            .createSignedUploadUrl(filePath);

        if (error) {
            console.error('Error generating signed url:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

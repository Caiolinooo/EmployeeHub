const BUCKET = 'documentos-trabalhistas';

type QueryClient = {
    from: (table: string) => any;
};

/** Caminho no bucket a partir de path cru ou URL pública/assinada do Storage. */
export function storagePathFromUrl(url: string | null | undefined, bucket = BUCKET): string {
    if (!url) return '';
    if (!url.includes('/storage/v1/object/')) return url;
    const marker = `/${bucket}/`;
    if (url.includes(marker)) {
        let path = decodeURIComponent(url.split(marker)[1] || '');
        const q = path.indexOf('?');
        if (q >= 0) path = path.slice(0, q);
        return path;
    }
    const publicMarker = '/object/public/';
    if (url.includes(publicMarker)) {
        const rest = url.split(publicMarker)[1] || '';
        const parts = rest.split('/');
        return decodeURIComponent(parts.slice(1).join('/').split('?')[0]);
    }
    return url;
}

/**
 * Último PDF assinado DESTE documento.
 * O filtro antigo em embed + .single() podia pegar a auditoria de outro arquivo
 * do envelope (ou falhar com 0 linhas) e a UI acabava mostrando um PDF só.
 */
export async function latestAuditForDocument(supabase: QueryClient, documentoId: string) {
    const { data: sols, error: solError } = await supabase
        .from('solicitacoes_assinatura')
        .select('id')
        .eq('documento_id', documentoId);
    if (solError || !sols?.length) return null;

    const ids = sols.map((s) => s.id);
    const { data, error } = await supabase
        .from('auditoria_assinaturas')
        .select('arquivo_assinado_url, hash_final, metadados')
        .in('solicitacao_id', ids)
        .order('data_assinatura', { ascending: false })
        .limit(1);
    if (error || !data?.length) return null;
    return data[0];
}

/**
 * CA (Certificado de Aprovação) Lookup Service
 * 
 * Lookup chain:
 * 1. Supabase cache (epi_ca_cache) 
 * 2. caepi.mte.gov.br official scraping (ASP.NET form)
 * 3. consultaca.com scraping (fallback)
 * 4. Manual entry (UI handles this)
 * 
 * Note: The MTE FTP file (ftp://ftp.mtps.gov.br/...) uses ftp:// protocol
 * which is NOT supported by Node.js fetch. For bulk sync, we use the
 * open-source API_BaseCAEPI Docker image or direct FTP client.
 */

import { supabaseAdmin } from '@/lib/db';
import type { CALookupResult, CAStatus } from '@/types/epi';
import {
    CONSULTA_CA_HOST,
    buildApiBaseCaepiLookupUrl,
    buildConsultaCaLookupUrl,
    UnsafeUrlError,
} from '@/lib/security/safe-url';
import { logCaLookupError } from './ca-lookup-log';

// ==================== CONSTANTS ====================

const MTE_CONSULTA_URL = 'https://caepi.mte.gov.br/internet/ConsultaCAInternet.aspx';
const CACHE_TTL_HOURS = 24;

// Scraping toggle: enable by default, disable via env var ENABLE_CA_SCRAPING=false
const ENABLE_SCRAPING = process.env.ENABLE_CA_SCRAPING !== 'false';

function getApiBaseCaepiUrl(): string {
    return (process.env.API_BASE_CAEPI_URL || '').trim();
}

// ==================== MAIN LOOKUP FUNCTION ====================

/**
 * Look up CA information by number.
 * First checks cache, then tries MTE scraping, then consultaca.com.
 */
export async function lookupCA(caNumber: string): Promise<CALookupResult | null> {
    if (!caNumber || caNumber.trim().length === 0) return null;

    const cleanCA = caNumber.trim().replace(/\D/g, ''); // Numbers only
    if (!cleanCA) return null;

    try {
        // 1. Check cache first
        const cached = await getCachedCA(cleanCA);
        if (cached) {
            console.log('[CA Lookup] Cache hit for CA %s', cleanCA);
            return cached;
        }

        // Generate variants: original + zero-padded to common lengths
        const variants = [cleanCA];
        if (cleanCA.length < 5) {
            variants.push(cleanCA.padStart(5, '0')); // e.g. 212 → 00212
        }

        let result: CALookupResult | null = null;

        // 2. Try official MTE site scraping
        if (ENABLE_SCRAPING) {
            for (const variant of variants) {
                console.log('[CA Lookup] Cache miss, trying MTE for CA %s...', variant);
                result = await scrapeMTEConsulta(variant);
                if (result) {
                    result.ca_number = cleanCA; // Normalize back to original
                    await cacheCAResult(result);
                    return result;
                }
            }

            // 3. Try consultaca.com as fallback (independent of MTE success)
            for (const variant of variants) {
                console.log('[CA Lookup] MTE miss, trying consultaca.com for CA %s...', variant);
                result = await scrapeConsultaCA(variant);
                if (result) {
                    result.ca_number = cleanCA;
                    await cacheCAResult(result);
                    return result;
                }
            }
        } else {
            console.log('[CA Lookup] Scraping disabled (set ENABLE_CA_SCRAPING=true to enable). Skipping MTE and consultaca.com.');
        }

        // 4. Try open-source API if configured
        if (getApiBaseCaepiUrl()) {
            for (const variant of variants) {
                console.log('[CA Lookup] Trying API_BaseCAEPI for CA %s...', variant);
                result = await queryAPIBaseCAEPI(variant);
                if (result) {
                    result.ca_number = cleanCA;
                    await cacheCAResult(result);
                    return result;
                }
            }
        }

        console.log('[CA Lookup] No result found for CA %s', cleanCA);
        return null;
    } catch (error) {
        logCaLookupError(cleanCA, error);
        return null;
    }
}

// ==================== CACHE OPERATIONS ====================

async function getCachedCA(caNumber: string): Promise<CALookupResult | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('epi_ca_cache')
            .select('*')
            .eq('ca_number', caNumber)
            .single();

        if (error || !data) return null;

        // Check if cache is still fresh
        const lastSynced = new Date(data.last_synced);
        const now = new Date();
        const hoursDiff = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > CACHE_TTL_HOURS) {
            console.log('[CA Lookup] Cache expired for CA %s (%sh old)', caNumber, hoursDiff.toFixed(1));
            return null;
        }

        return mapCacheToResult(data);
    } catch (error) {
        console.error('[CA Lookup] Cache read error:', error);
        return null;
    }
}

async function cacheCAResult(result: CALookupResult): Promise<void> {
    try {
        const { error } = await supabaseAdmin
            .from('epi_ca_cache')
            .upsert({
                ca_number: result.ca_number,
                validity_date: result.validity_date,
                status: result.status,
                manufacturer: result.manufacturer,
                equipment_name: result.equipment_name,
                equipment_description: result.equipment_description,
                brand: result.brand,
                process_number: result.process_number,
                norm: result.norm,
                source: result.source,
                last_synced: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'ca_number' });

        if (error) {
            console.error('[CA Lookup] Cache write error:', error);
        }
    } catch (error) {
        console.error('[CA Lookup] Cache write error:', error);
    }
}

function mapCacheToResult(data: any): CALookupResult {
    return {
        ca_number: data.ca_number,
        validity_date: data.validity_date,
        status: data.status || 'DESCONHECIDO',
        manufacturer: data.manufacturer || '',
        equipment_name: data.equipment_name || '',
        equipment_description: data.equipment_description || '',
        brand: data.brand || '',
        process_number: data.process_number || '',
        norm: data.norm || '',
        source: 'cache',
        last_synced: data.last_synced || data.updated_at
    };
}

// ==================== MTE OFFICIAL SITE SCRAPING ====================

/**
 * Scrape caepi.mte.gov.br/internet/ConsultaCAInternet.aspx
 * This is an ASP.NET WebForms page that requires:
 * 1. GET to fetch __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION
 * 2. POST with form data including the CA number
 */
async function scrapeMTEConsulta(caNumber: string): Promise<CALookupResult | null> {
    try {
        // Step 1: GET the page to extract ASP.NET form tokens + dropdown defaults
        const controller1 = new AbortController();
        const timeout1 = setTimeout(() => controller1.abort(), 15000);

        const commonHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
        };

        const getResponse = await fetch(MTE_CONSULTA_URL, {
            signal: controller1.signal,
            headers: commonHeaders
        });

        clearTimeout(timeout1);
        if (!getResponse.ok) {
            console.warn('[CA Lookup] MTE GET returned %s', getResponse.status);
            return null;
        }

        const html = await getResponse.text();
        console.log('[CA Lookup] MTE GET OK (%s bytes)', html.length);

        // Extract ASP.NET hidden fields
        const viewState = extractHiddenField(html, '__VIEWSTATE');
        const viewStateGenerator = extractHiddenField(html, '__VIEWSTATEGENERATOR');
        const eventValidation = extractHiddenField(html, '__EVENTVALIDATION');

        if (!viewState || !eventValidation) {
            console.warn('[CA Lookup] Could not extract ASP.NET form tokens from MTE page');
            return null;
        }

        // Extract actual default option values from each dropdown (ASP.NET __EVENTVALIDATION
        // will reject any value that wasn't rendered in the page)
        const equipDefault = extractFirstOptionValue(html, 'cboEquipamento');
        const fabDefault = extractFirstOptionValue(html, 'cboFabricante');
        const tipoDefault = extractFirstOptionValue(html, 'cboTipoProtecao');
        console.log('[CA Lookup] MTE dropdown defaults: equip=%s fab=%s tipo=%s', equipDefault, fabDefault, tipoDefault);

        // Extract cookies from GET response
        const setCookie = getResponse.headers.get('set-cookie') || '';
        const cookies = setCookie.split(',')
            .map(c => c.split(';')[0].trim())
            .filter(c => c.length > 0)
            .join('; ');

        // Small delay to avoid anti-bot
        await new Promise(r => setTimeout(r, 300));

        // Step 2: Standard form POST with exact values from the page
        const formData = new URLSearchParams();
        formData.set('__VIEWSTATE', viewState);
        if (viewStateGenerator) formData.set('__VIEWSTATEGENERATOR', viewStateGenerator);
        formData.set('__EVENTVALIDATION', eventValidation);
        formData.set('__EVENTTARGET', '');
        formData.set('__EVENTARGUMENT', '');
        formData.set('ctl00$PlaceHolderConteudo$txtNumeroCA', caNumber);
        // Use exact dropdown defaults from the rendered page
        if (equipDefault) formData.set('ctl00$PlaceHolderConteudo$cboEquipamento', equipDefault);
        if (fabDefault) formData.set('ctl00$PlaceHolderConteudo$cboFabricante', fabDefault);
        if (tipoDefault) formData.set('ctl00$PlaceHolderConteudo$cboTipoProtecao', tipoDefault);
        formData.set('ctl00$PlaceHolderConteudo$btnConsultar', 'Consultar');

        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 15000);

        const postResponse = await fetch(MTE_CONSULTA_URL, {
            method: 'POST',
            signal: controller2.signal,
            headers: {
                ...commonHeaders,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': MTE_CONSULTA_URL,
                'Origin': 'https://caepi.mte.gov.br',
                'Cookie': cookies
            },
            body: formData.toString()
        });

        clearTimeout(timeout2);
        if (!postResponse.ok) {
            console.warn('[CA Lookup] MTE POST returned %s', postResponse.status);
            return null;
        }

        const resultHtml = await postResponse.text();
        console.log('[CA Lookup] MTE POST OK (%s bytes)', resultHtml.length);

        // Check for result indicators in the full HTML response
        const hasResults = resultHtml.includes('lblSituacao') ||
            resultHtml.includes('lblDataValidade') ||
            resultHtml.includes('lblRazaoSocial') ||
            resultHtml.includes('Razão Social') ||
            resultHtml.includes('Raz&atilde;o Social') ||
            resultHtml.includes('grdResultado') ||
            resultHtml.includes('NRProcesso') ||
            resultHtml.includes('_lblCA');

        if (!hasResults) {
            const snippet = resultHtml.substring(0, 1000).replace(/\s+/g, ' ');
            console.warn('[CA Lookup] MTE POST: no result indicators found. Snippet: %s', snippet);
            return null;
        }

        return parseMTEResultHTML(caNumber, resultHtml);
    } catch (error: any) {
        console.warn('[CA Lookup] MTE scraping failed:', error.message);
        return null;
    }
}

/**
 * Extract the first <option> value from a <select> by partial ID match.
 * ASP.NET renders: <select id="PlaceHolderConteudo_cboEquipamento" name="ctl00$PlaceHolderConteudo$cboEquipamento">
 */
function extractFirstOptionValue(html: string, selectPartialId: string): string {
    // Find the <select> tag, then its first <option>
    const selectPattern = new RegExp(
        `<select[^>]*(?:id|name)="[^"]*${selectPartialId}"[^>]*>\\s*<option[^>]*value="([^"]*)"`,
        'i'
    );
    const match = html.match(selectPattern);
    if (match?.[1]) return match[1];

    // Fallback: try selected="selected"
    const selectedPattern = new RegExp(
        `<select[^>]*${selectPartialId}[^>]*>[\\s\\S]*?<option[^>]*selected[^>]*value="([^"]*)"`,
        'i'
    );
    const selectedMatch = html.match(selectedPattern);
    return selectedMatch?.[1] || '';
}

function extractHiddenField(html: string, fieldName: string): string | null {
    // Match: <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="..." />
    const patterns = [
        new RegExp(`name="${fieldName}"[^>]*value="([^"]*)"`, 'i'),
        new RegExp(`id="${fieldName}"[^>]*value="([^"]*)"`, 'i'),
        new RegExp(`value="([^"]*)"[^>]*name="${fieldName}"`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

function parseMTEResultHTML(caNumber: string, html: string): CALookupResult | null {
    try {
        // MTE shows results in spans/labels with specific IDs
        // Pattern: ctl00_PlaceHolderConteudo_lblXxxxx
        const extractById = (idPattern: string): string => {
            const patterns = [
                new RegExp(`id=".*${idPattern}"[^>]*>([^<]+)<`, 'i'),
                new RegExp(`id=".*${idPattern}"[^>]*>\\s*([^<]+)\\s*<`, 'i'),
            ];
            for (const p of patterns) {
                const match = html.match(p);
                if (match?.[1]) return match[1].trim();
            }
            return '';
        };

        // Also try generic label extraction
        const extractByLabel = (label: string): string => {
            const patterns = [
                new RegExp(`>${label}[:\\s]*</[^>]+>\\s*<[^>]+>([^<]+)<`, 'i'),
                new RegExp(`${label}[^<]*<[^>]+[^>]*>([^<]+)`, 'i'),
                new RegExp(`<td[^>]*>${label}</td>\\s*<td[^>]*>([^<]+)`, 'i'),
            ];
            for (const p of patterns) {
                const match = html.match(p);
                if (match?.[1]) return match[1].trim();
            }
            return '';
        };

        // Try various ID patterns used by the MTE site (PlaceHolderConteudo)
        const situacao =
            extractById('lblSituacao') ||
            extractByLabel('Situa[çc][ãa]o');

        const validadeStr =
            extractById('lblValidade') ||
            extractById('lblDataValidade') ||
            extractByLabel('Validade|Data de Validade|Vencimento');

        const fabricante =
            extractById('lblRazaoSocial') ||
            extractByLabel('Raz[ãa]o Social|Fabricante');

        const equipamento =
            extractById('lblEquipamento') ||
            extractByLabel('Equipamento|Nome do Equipamento');

        const descricao =
            extractById('lblDescricao') ||
            extractByLabel('Descri[çc][ãa]o');

        const marca =
            extractById('lblMarcaCA') ||
            extractByLabel('Marca');

        const processo =
            extractById('lblProcesso') ||
            extractByLabel('Processo|N[úu]mero');

        const norma =
            extractById('lblNorma') ||
            extractByLabel('Norma');

        // Parse validity date
        let validity_date: string | null = null;
        if (validadeStr) {
            const dateMatch = validadeStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) {
                validity_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00.000Z`;
            }
        }

        // Parse status
        let status: CAStatus = 'DESCONHECIDO';
        if (situacao) {
            const upper = situacao.toUpperCase();
            if (upper.includes('VÁLIDO') || upper === 'VALIDO' || upper.includes('VIGENTE')) status = 'VÁLIDO';
            else if (upper.includes('VENCIDO')) status = 'VENCIDO';
            else if (upper.includes('SUSPENSO')) status = 'SUSPENSO';
            else if (upper.includes('CANCELADO')) status = 'CANCELADO';
        }

        // Only return if we found useful data (at least status or validity)
        if (status === 'DESCONHECIDO' && !validity_date && !equipamento) {
            // Check if the page has a "not found" message
            if (html.toLowerCase().includes('não encontrado') || html.toLowerCase().includes('nenhum registro')) {
                console.log('[CA Lookup] MTE: CA %s not found', caNumber);
            }
            return null;
        }

        return {
            ca_number: caNumber,
            validity_date,
            status,
            manufacturer: fabricante,
            equipment_name: equipamento,
            equipment_description: descricao,
            brand: marca,
            process_number: processo,
            norm: norma,
            source: 'mte',
            last_synced: new Date().toISOString()
        };
    } catch (error) {
        console.error('[CA Lookup] MTE HTML parse error:', error);
        return null;
    }
}

// ==================== CONSULTACA.COM SCRAPING ====================

export async function scrapeConsultaCA(
    caNumber: string,
    fetchImpl: typeof fetch = fetch,
): Promise<CALookupResult | null> {
    try {
        const url = buildConsultaCaLookupUrl(caNumber);
        if (url.protocol !== 'https:' || url.hostname !== CONSULTA_CA_HOST) {
            return null;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetchImpl(url.href, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"'
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.warn('[CA Lookup] consultaca.com returned status %s', response.status);
            return null;
        }

        const html = await response.text();
        return parseConsultaCAHTML(caNumber, html);
    } catch (error: any) {
        if (error instanceof UnsafeUrlError) {
            console.warn('[CA Lookup] consultaca.com URL blocked:', error.message);
            return null;
        }
        console.warn('[CA Lookup] consultaca.com scraping failed:', error.message);
        return null;
    }
}

function parseConsultaCAHTML(caNumber: string, html: string): CALookupResult | null {
    try {
        const extractField = (label: string): string => {
            const patterns = [
                new RegExp(`${label}[^<]*<[^>]*>([^<]+)`, 'i'),
                new RegExp(`${label}.*?:\\s*([^<\\n]+)`, 'i'),
                new RegExp(`<td[^>]*>${label}<\\/td>\\s*<td[^>]*>([^<]+)`, 'i'),
            ];
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match?.[1]) return match[1].trim();
            }
            return '';
        };

        const validityStr = extractField('Validade|Data de Validade|Vencimento');
        let validity_date: string | null = null;
        if (validityStr) {
            const dateMatch = validityStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (dateMatch) {
                validity_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T00:00:00.000Z`;
            }
        }

        const situacao = extractField('Situa[çc][ãa]o|Status');
        let status: CAStatus = 'DESCONHECIDO';
        if (situacao) {
            const upper = situacao.toUpperCase();
            if (upper.includes('VÁLIDO') || upper.includes('VALIDO')) status = 'VÁLIDO';
            else if (upper.includes('VENCIDO')) status = 'VENCIDO';
            else if (upper.includes('SUSPENSO')) status = 'SUSPENSO';
            else if (upper.includes('CANCELADO')) status = 'CANCELADO';
        }

        if (status === 'DESCONHECIDO' && !validity_date) {
            return null;
        }

        return {
            ca_number: caNumber,
            validity_date,
            status,
            manufacturer: extractField('Raz[ãa]o Social|Fabricante'),
            equipment_name: extractField('Equipamento|Nome do Equipamento'),
            equipment_description: extractField('Descri[çc][ãa]o'),
            brand: extractField('Marca'),
            process_number: extractField('Processo|N[úu]mero do Processo'),
            norm: extractField('Norma'),
            source: 'scraping',
            last_synced: new Date().toISOString()
        };
    } catch (error) {
        console.error('[CA Lookup] consultaca.com parse error:', error);
        return null;
    }
}

// ==================== OPEN-SOURCE API FALLBACK ====================

/**
 * Query the API_BaseCAEPI Docker image if configured.
 * GitHub: https://github.com/JoaoAugustoMV/API_BaseCAEPI
 * Docker: https://hub.docker.com/r/joaoaugustomv/api_base_ca_epi
 */
export async function queryAPIBaseCAEPI(
    caNumber: string,
    fetchImpl: typeof fetch = fetch,
): Promise<CALookupResult | null> {
    const configured = getApiBaseCaepiUrl();
    if (!configured) return null;

    try {
        const url = buildApiBaseCaepiLookupUrl(configured, caNumber);
        if (url.protocol !== 'https:' || url.hostname !== new URL(configured).hostname) {
            return null;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetchImpl(url.href, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeout);

        if (!response.ok) return null;

        const data = await response.json();
        if (!data || !data.NRRegistroCA) return null;

        let validity_date: string | null = null;
        if (data.DataValidade) {
            const parts = data.DataValidade.split('/');
            if (parts.length === 3) {
                validity_date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T00:00:00.000Z`;
            }
        }

        const rawStatus = (data.Situacao || '').toUpperCase();
        let status: CAStatus = 'DESCONHECIDO';
        if (rawStatus.includes('VÁLIDO') || rawStatus === 'VALIDO') status = 'VÁLIDO';
        else if (rawStatus.includes('VENCIDO')) status = 'VENCIDO';
        else if (rawStatus.includes('SUSPENSO')) status = 'SUSPENSO';
        else if (rawStatus.includes('CANCELADO')) status = 'CANCELADO';

        return {
            ca_number: caNumber,
            validity_date,
            status,
            manufacturer: data.RazaoSocial || '',
            equipment_name: data.NomeEquipamento || '',
            equipment_description: data.DescricaoEquipamento || '',
            brand: data.MarcaCA || '',
            process_number: data.NRProcesso || '',
            norm: data.Norma || '',
            source: 'api',
            last_synced: new Date().toISOString()
        };
    } catch (error: any) {
        if (error instanceof UnsafeUrlError) {
            console.warn('[CA Lookup] API_BaseCAEPI URL blocked:', error.message);
            return null;
        }
        console.warn('[CA Lookup] API_BaseCAEPI failed:', error.message);
        return null;
    }
}

// ==================== BULK SYNC ====================

/**
 * Sync CA database by querying a list of known CA numbers.
 * For full FTP sync, use the API_BaseCAEPI Docker image or manual upload.
 * This function syncs CA data for all existing EPI types that have ca_number set.
 */
export async function syncCADatabase(): Promise<{ synced: number; errors: number }> {
    console.log('[CA Sync] Starting database sync from existing EPI types...');
    let synced = 0;
    let errors = 0;

    try {
        // Get all EPI types that have a CA number
        const { data: types, error: typesError } = await supabaseAdmin
            .from('epi_types')
            .select('id, ca_number')
            .not('ca_number', 'is', null)
            .neq('ca_number', '');

        if (typesError || !types || types.length === 0) {
            console.log('[CA Sync] No EPI types with CA numbers found');
            return { synced: 0, errors: 0 };
        }

        // Also get CA numbers from registrations
        const { data: regs } = await supabaseAdmin
            .from('epi_registrations')
            .select('equipment_ca')
            .not('equipment_ca', 'is', null)
            .neq('equipment_ca', '');

        // Combine unique CA numbers
        const caNumbers = new Set<string>();
        types.forEach(t => { if (t.ca_number) caNumbers.add(t.ca_number.trim().replace(/\D/g, '')); });
        if (regs) regs.forEach(r => { if (r.equipment_ca) caNumbers.add(r.equipment_ca.trim().replace(/\D/g, '')); });

        console.log('[CA Sync] Syncing %s unique CA numbers...', caNumbers.size);

        for (const ca of caNumbers) {
            if (!ca) continue;
            try {
                // Skip cache, force fresh lookup
                let result: CALookupResult | null = null;

                // Try MTE first
                if (ENABLE_SCRAPING) {
                    result = await scrapeMTEConsulta(ca);
                    if (!result) {
                        result = await scrapeConsultaCA(ca);
                    }
                }
                if (!result && getApiBaseCaepiUrl()) {
                    result = await queryAPIBaseCAEPI(ca);
                }

                if (result) {
                    await cacheCAResult(result);

                    // Also update the EPI type with CA metadata
                    const matchingTypes = types.filter(t => t.ca_number?.trim().replace(/\D/g, '') === ca);
                    for (const type of matchingTypes) {
                        await supabaseAdmin
                            .from('epi_types')
                            .update({
                                ca_validity_date: result.validity_date,
                                ca_status: result.status,
                                ca_manufacturer: result.manufacturer,
                                ca_equipment_name: result.equipment_name,
                            })
                            .eq('id', type.id);
                    }

                    synced++;
                } else {
                    errors++;
                }

                // Rate limiting: wait 1 second between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.error('[CA Sync] Error syncing CA %s:', ca, e);
                errors++;
            }
        }

        console.log('[CA Sync] Complete: %s synced, %s errors', synced, errors);
        return { synced, errors };
    } catch (error) {
        console.error('[CA Sync] Sync failed:', error);
        throw error;
    }
}

// ==================== HELPERS ====================

/**
 * Update CA info on an EPIType by looking up its ca_number.
 */
export async function enrichEPITypeWithCA(caNumber: string): Promise<{
    ca_validity_date?: string;
    ca_status?: string;
    ca_manufacturer?: string;
    ca_equipment_name?: string;
} | null> {
    const result = await lookupCA(caNumber);
    if (!result) return null;

    return {
        ca_validity_date: result.validity_date || undefined,
        ca_status: result.status,
        ca_manufacturer: result.manufacturer || undefined,
        ca_equipment_name: result.equipment_name || undefined,
    };
}

/**
 * Get cache statistics for admin display.
 */
export async function getCacheStats(): Promise<{ total: number; lastSync: string | null }> {
    try {
        const { count, error } = await supabaseAdmin
            .from('epi_ca_cache')
            .select('*', { count: 'exact', head: true });

        const { data: latest } = await supabaseAdmin
            .from('epi_ca_cache')
            .select('last_synced')
            .order('last_synced', { ascending: false })
            .limit(1)
            .single();

        return {
            total: count || 0,
            lastSync: latest?.last_synced || null
        };
    } catch {
        return { total: 0, lastSync: null };
    }
}

import { supabaseAdmin } from '@/lib/supabase';
import { normalizeCpf } from '@/lib/gestao-tripulantes/cpf';
import { findColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import type { GTDocumento, GTColaborador } from '@/types/gestao-tripulantes';

interface PoliWebCredentials {
  username: string;
  password: string;
  habilitado: boolean;
}

export interface PoliWebASO {
  colaboradorCpf: string;
  colaboradorNome: string;
  tipoExame: string;
  dataRealizacao: string;
  dataValidade: string;
  resultado: string;
  medicoNome?: string;
  medicoCRM?: string;
  clinicaNome?: string;
}

async function getPoliWebCredentials(): Promise<PoliWebCredentials | null> {
  try {
    const supabase = supabaseAdmin;
    const { data: configs } = await supabase
      .from('gt_configuracoes')
      .select('chave, valor')
      .in('chave', ['poliweb_username', 'poliweb_password', 'poliweb_habilitado']);

    if (!configs || configs.length === 0) return null;

    const map = Object.fromEntries(
      configs.map((c: { chave: string; valor: any }) => [c.chave, c.valor])
    );

    return {
      username: (map.poliweb_username as string) || '',
      password: (map.poliweb_password as string) || '',
      habilitado: map.poliweb_habilitado === true || map.poliweb_habilitado === 'true',
    };
  } catch (error) {
    console.error('Erro ao buscar credenciais PoliWeb:', error);
    return null;
  }
}

function formatDateForDb(dateStr: string): string | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
  const parts = cleanStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parseASOsFromHTML(html: string): PoliWebASO[] {
  const asos: PoliWebASO[] = [];
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '').trim();
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let trMatch;
  while ((trMatch = trRegex.exec(cleanHtml)) !== null) {
    const trContent = trMatch[1];
    const tds: string[] = [];
    let tdMatch;

    tdRegex.lastIndex = 0;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      const cleanTd = tdMatch[1].replace(/<[^>]*>/g, '').trim();
      tds.push(cleanTd);
    }

    // ASO table: CPF, Nome, Tipo Exame, Data Realização, Data Validade, Resultado, Médico, CRM
    if (tds.length >= 5) {
      const cpf = normalizeCpf(tds[0]);
      if (cpf.length === 11) {
        asos.push({
          colaboradorCpf: tds[0],
          colaboradorNome: tds[1],
          tipoExame: tds[2],
          dataRealizacao: tds[3],
          dataValidade: tds[4],
          resultado: tds[5] || 'Apto',
          medicoNome: tds[6] || undefined,
          medicoCRM: tds[7] || undefined,
        });
      }
    }
  }

  return asos;
}

/** Upstream Poliweb hang (~5s) must not block GT page load. */
export const POLIWEB_FETCH_TIMEOUT_MS = 2500;

async function fetchPoliweb(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = () =>
    new Error(`PoliWeb indisponível (timeout ${POLIWEB_FETCH_TIMEOUT_MS}ms)`);

  try {
    return await new Promise<Response>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(timeoutError());
      }, POLIWEB_FETCH_TIMEOUT_MS);

      fetch(url, {
        ...init,
        signal: controller.signal,
        cache: 'no-store',
      }).then(resolve, (err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          reject(timeoutError());
          return;
        }
        reject(err);
      });
    });
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function scrapePoliWeb(): Promise<{
  success: boolean;
  data?: PoliWebASO[];
  error?: string;
}> {
  try {
    const credentials = await getPoliWebCredentials();
    if (!credentials || !credentials.habilitado) {
      return { success: false, error: 'PoliWeb não está configurado ou habilitado' };
    }

    if (!credentials.username || !credentials.password) {
      return { success: false, error: 'Credenciais PoliWeb incompletas' };
    }

    // In a real environment, we call the Poliweb site.
    // If the site is down or for testing, we can simulate responses if username is 'teste' or 'mock'
    if (credentials.username === 'teste' || credentials.username === 'mock') {
      return {
        success: true,
        data: [
          {
            colaboradorCpf: '111.222.333-44',
            colaboradorNome: 'Colaborador Teste 1',
            tipoExame: 'Admissional',
            dataRealizacao: new Date().toLocaleDateString('pt-BR'),
            dataValidade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
            resultado: 'Apto',
            medicoNome: 'Dr. Lucas Medeiros',
            medicoCRM: '123456-RJ',
          },
          {
            colaboradorCpf: '555.665.777-88',
            colaboradorNome: 'Colaborador Teste 2',
            tipoExame: 'Periodico',
            dataRealizacao: new Date().toLocaleDateString('pt-BR'),
            dataValidade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
            resultado: 'Apto',
            medicoNome: 'Dra. Mariana Silva',
            medicoCRM: '789123-RJ',
          }
        ]
      };
    }

    const loginResponse = await fetchPoliweb('https://poliweb.com.br/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        usuario: credentials.username,
        senha: credentials.password,
      }),
    });

    if (!loginResponse.ok) {
      return { success: false, error: 'Falha na autenticação com PoliWeb' };
    }

    const cookies = loginResponse.headers.get('set-cookie') || '';

    const asosResponse = await fetchPoliweb('https://poliweb.com.br/asos', {
      headers: { Cookie: cookies },
    });

    if (!asosResponse.ok) {
      return { success: false, error: 'Falha ao buscar ASOs no PoliWeb' };
    }

    const html = await asosResponse.text();
    const asos = parseASOsFromHTML(html);

    return { success: true, data: asos };
  } catch (error) {
    console.error('Erro ao acessar PoliWeb:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function buscarASOsPendentes(): Promise<{
  success: boolean;
  data?: (PoliWebASO & { colaboradorLocal?: GTColaborador })[];
  error?: string;
}> {
  try {
    const result = await scrapePoliWeb();
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Nenhum ASO encontrado' };
    }

    const supabase = supabaseAdmin;

    const asosProcessados = await Promise.all(
      result.data.map(async (aso) => {
        const hit = await findColaboradorByCpf(aso.colaboradorCpf);
        if (!hit) return null;
        const { data: colaborador } = await supabase
          .from('gt_colaboradores')
          .select('*')
          .eq('id', hit.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (!colaborador) return null;

        const dataRealizacaoClean = formatDateForDb(aso.dataRealizacao);
        if (!dataRealizacaoClean) return null;

        // Check if there is an existing ASO document for this collaborator on this date
        const { data: existingDoc } = await supabase
          .from('gt_documentos')
          .select('id')
          .eq('colaborador_id', colaborador.id)
          .eq('tipo_documento', 'aso')
          .eq('data_emissao', dataRealizacaoClean)
          .is('deleted_at', null)
          .maybeSingle();

        if (existingDoc) return null;

        return { ...aso, colaboradorLocal: colaborador };
      })
    );

    const pendentes = asosProcessados.filter(
      (item): item is PoliWebASO & { colaboradorLocal: GTColaborador } =>
        item !== null
    );

    return { success: true, data: pendentes };
  } catch (error) {
    console.error('Erro ao buscar ASOs pendentes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

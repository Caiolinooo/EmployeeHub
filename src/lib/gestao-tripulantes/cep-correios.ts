/** Consulta de CEP na base dos Correios (ViaCEP) com fallback BrasilAPI. */

export interface EnderecoCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export function normalizarCep(valor: string): string {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

export function formatarCep(valor: string): string {
  const d = normalizarCep(valor);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Resposta ViaCEP → endereço. `erro: true` ou CEP curto → null. */
export function enderecoDeViaCep(json: unknown): EnderecoCep | null {
  if (!json || typeof json !== 'object') return null;
  const row = json as Record<string, unknown>;
  if (row.erro === true || row.erro === 'true') return null;
  const cep = normalizarCep(texto(row.cep));
  if (cep.length !== 8) return null;
  return {
    cep: formatarCep(cep),
    logradouro: texto(row.logradouro),
    complemento: texto(row.complemento),
    bairro: texto(row.bairro),
    cidade: texto(row.localidade),
    uf: texto(row.uf).toUpperCase(),
  };
}

/** Resposta BrasilAPI /cep/v2 → endereço. */
export function enderecoDeBrasilApi(json: unknown): EnderecoCep | null {
  if (!json || typeof json !== 'object') return null;
  const row = json as Record<string, unknown>;
  const cep = normalizarCep(texto(row.cep));
  if (cep.length !== 8) return null;
  return {
    cep: formatarCep(cep),
    logradouro: texto(row.street),
    complemento: '',
    bairro: texto(row.neighborhood),
    cidade: texto(row.city),
    uf: texto(row.state).toUpperCase(),
  };
}

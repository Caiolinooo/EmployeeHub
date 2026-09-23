/**
 * Monta o FaturaRenderInput (contrato §3.3) a partir do banco: fatura+itens,
 * emissor (payroll_companies), cliente (snapshot/cliente) e conta bancária
 * para a seção Corporate Account Details.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { obterFatura, erro404 } from '@/lib/financeiro/service';
import type { FaturaRenderInput, FaturaItemRender } from '@/lib/financeiro/invoice/types';
import type { FinFatura, FinFaturaItem } from '@/types/financeiro';

function enderecoLinha(endereco: unknown, pais?: string | null): string | undefined {
  if (!endereco || typeof endereco !== 'object') return undefined;
  const e = endereco as Record<string, unknown>;
  // Tomador no exterior: endereço internacional (street/city/state/postcode/country).
  const partes = (pais || 'BR').toUpperCase() !== 'BR'
    ? [e.street, e.city, e.state, e.postcode, e.country]
    : [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.cep];
  return partes
    .filter(Boolean)
    .map(String)
    .join(', ') || undefined;
}

/** Endereço da empresa emissora: colunas estruturadas (migration 20260923_000001) com fallback ao address TEXT legado. */
function enderecoEmpresa(emp: {
  logradouro?: string | null; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cep?: string | null; municipio?: string | null; uf?: string | null;
  address?: string | null;
}): string | undefined {
  const estruturado = [emp.logradouro, emp.numero, emp.complemento, emp.bairro, emp.cep, emp.municipio, emp.uf]
    .filter(Boolean)
    .map(String)
    .join(', ');
  return estruturado || emp.address || undefined;
}

export async function montarFaturaRenderInput(faturaId: string): Promise<FaturaRenderInput> {
  const fatura = await obterFatura(faturaId);
  const fin = fatura as FinFatura & { itens?: FinFaturaItem[] };

  const { data: empresa } = await supabaseAdmin
    .from('payroll_companies')
    .select('name, cnpj, address, email, phone, razao_social, logradouro, numero, complemento, bairro, cep, municipio, uf')
    .eq('id', fin.empresa_id)
    .maybeSingle();
  if (!empresa) throw erro404('empresa_ausente', 'Empresa emissora não encontrada');
  const emp = empresa as {
    name: string; cnpj: string; address?: string; email?: string; phone?: string;
    razao_social?: string | null; logradouro?: string | null; numero?: string | null;
    complemento?: string | null; bairro?: string | null; cep?: string | null;
    municipio?: string | null; uf?: string | null;
  };

  const snapshot = (fin.cliente_snapshot || null) as
    | { nome?: string; documento?: string; endereco?: unknown; pais?: string; tax_id?: string }
    | null;
  let clienteNome = snapshot?.nome;
  let clienteDocumento = snapshot?.documento;
  let clientePais = snapshot?.pais;
  let clienteTaxId = snapshot?.tax_id;
  let clienteEndereco = enderecoLinha(snapshot?.endereco, clientePais);
  if (fin.cliente_id) {
    const { data: cliente } = await supabaseAdmin
      .from('fin_clientes')
      .select('nome, documento, endereco, pais, tax_id')
      .eq('id', fin.cliente_id)
      .maybeSingle();
    if (cliente) {
      const c = cliente as { nome: string; documento?: string; endereco?: unknown; pais?: string; tax_id?: string };
      clienteNome = c.nome;
      clienteDocumento = c.documento;
      clientePais = c.pais;
      clienteTaxId = c.tax_id;
      clienteEndereco = enderecoLinha(c.endereco, c.pais);
    }
  }
  if (!clienteNome) throw erro404('cliente_ausente', 'Fatura sem cliente vinculado');
  // Tomador exterior: exibe o Tax ID/VAT alfanumérico no lugar do documento BR.
  const clienteDocumentoExibicao = (clientePais || 'BR').toUpperCase() !== 'BR'
    ? clienteTaxId || clienteDocumento
    : clienteDocumento;

  const itens: FaturaItemRender[] = (fin.itens || []).map((it) => ({
    descricao: it.descricao,
    referencia: it.referencia || undefined,
    quantidade: Number(it.quantidade),
    valorUnitario: Number(it.valor_unitario),
    valorTotal: Number(it.valor_total),
  }));

  const { data: conta } = await supabaseAdmin
    .from('fin_contas_bancarias')
    .select('banco_nome, agencia, conta, titular_nome, integracao_id, swift_bic, iban, routing_number, sort_code, moeda, banco_correspondente')
    .eq('empresa_id', fin.empresa_id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  let contaBancaria: FaturaRenderInput['contaBancaria'];
  if (conta) {
    const c = conta as {
      banco_nome: string | null; agencia: string | null; conta: string | null;
      titular_nome: string; integracao_id: string | null;
      swift_bic: string | null; iban: string | null; routing_number: string | null;
      sort_code: string | null; moeda: string | null; banco_correspondente: string | null;
    };
    contaBancaria = {
      bancoNome: c.banco_nome || '',
      agencia: c.agencia || '',
      conta: c.conta || '',
      titularNome: c.titular_nome,
      swiftBic: c.swift_bic || undefined,
      iban: c.iban || undefined,
      routingNumber: c.routing_number || undefined,
      sortCode: c.sort_code || undefined,
      moeda: c.moeda || undefined,
      bancoCorrespondente: c.banco_correspondente || undefined,
    };
  }
  return {
    fatura: {
      numero: fin.numero,
      ano: fin.ano,
      dataEmissao: fin.data_emissao || undefined,
      dataVencimento: fin.data_vencimento || undefined,
      moeda: fin.moeda,
      valorTotal: Number(fin.valor_total),
      callOff: fin.call_off || undefined,
      vesselName: fin.vessel_name || undefined,
      poNumber: fin.po_number || undefined,
      observacoes: fin.observacoes || undefined,
      competencia:
        fin.competencia_ano && fin.competencia_mes
          ? `${String(fin.competencia_mes).padStart(2, '0')}/${fin.competencia_ano}`
          : undefined,
      status: fin.status,
    },
    emissor: {
      razaoSocial: emp.razao_social || emp.name,
      cnpj: emp.cnpj,
      endereco: enderecoEmpresa(emp),
      email: emp.email || undefined,
      telefone: emp.phone || undefined,
    },
    cliente: {
      nome: clienteNome,
      documento: clienteDocumentoExibicao || undefined,
      endereco: clienteEndereco,
    },
    itens,
    contaBancaria,
  };
}

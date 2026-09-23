/**
 * Monta o FaturaRenderInput (contrato §3.3) a partir do banco: fatura+itens,
 * emissor (payroll_companies), cliente (snapshot/cliente) e conta bancária
 * para a seção Corporate Account Details.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { obterFatura, erro404 } from '@/lib/financeiro/service';
import type { FaturaRenderInput, FaturaItemRender } from '@/lib/financeiro/invoice/types';
import type { FinFatura, FinFaturaItem } from '@/types/financeiro';

function enderecoLinha(endereco: unknown): string | undefined {
  if (!endereco || typeof endereco !== 'object') return undefined;
  const e = endereco as Record<string, unknown>;
  return [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.cep]
    .filter(Boolean)
    .map(String)
    .join(', ') || undefined;
}

export async function montarFaturaRenderInput(faturaId: string): Promise<FaturaRenderInput> {
  const fatura = await obterFatura(faturaId);
  const fin = fatura as FinFatura & { itens?: FinFaturaItem[] };

  const { data: empresa } = await supabaseAdmin
    .from('payroll_companies')
    .select('name, cnpj, address, email, phone')
    .eq('id', fin.empresa_id)
    .maybeSingle();
  if (!empresa) throw erro404('empresa_ausente', 'Empresa emissora não encontrada');
  const emp = empresa as { name: string; cnpj: string; address?: string; email?: string; phone?: string };

  const snapshot = (fin.cliente_snapshot || null) as
    | { nome?: string; documento?: string; endereco?: unknown }
    | null;
  let clienteNome = snapshot?.nome;
  let clienteDocumento = snapshot?.documento;
  let clienteEndereco = enderecoLinha(snapshot?.endereco);
  if (fin.cliente_id) {
    const { data: cliente } = await supabaseAdmin
      .from('fin_clientes')
      .select('nome, documento, endereco')
      .eq('id', fin.cliente_id)
      .maybeSingle();
    if (cliente) {
      const c = cliente as { nome: string; documento?: string; endereco?: unknown };
      clienteNome = c.nome;
      clienteDocumento = c.documento;
      clienteEndereco = enderecoLinha(c.endereco);
    }
  }
  if (!clienteNome) throw erro404('cliente_ausente', 'Fatura sem cliente vinculado');

  const itens: FaturaItemRender[] = (fin.itens || []).map((it) => ({
    descricao: it.descricao,
    referencia: it.referencia || undefined,
    quantidade: Number(it.quantidade),
    valorUnitario: Number(it.valor_unitario),
    valorTotal: Number(it.valor_total),
  }));

  const { data: conta } = await supabaseAdmin
    .from('fin_contas_bancarias')
    .select('banco_nome, agencia, conta, titular_nome, integracao_id')
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
    };
    contaBancaria = {
      bancoNome: c.banco_nome || '',
      agencia: c.agencia || '',
      conta: c.conta || '',
      titularNome: c.titular_nome,
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
      observacoes: fin.observacoes || undefined,
      competencia:
        fin.competencia_ano && fin.competencia_mes
          ? `${String(fin.competencia_mes).padStart(2, '0')}/${fin.competencia_ano}`
          : undefined,
      status: fin.status,
    },
    emissor: {
      razaoSocial: emp.name,
      cnpj: emp.cnpj,
      endereco: emp.address || undefined,
      email: emp.email || undefined,
      telefone: emp.phone || undefined,
    },
    cliente: {
      nome: clienteNome,
      documento: clienteDocumento || undefined,
      endereco: clienteEndereco,
    },
    itens,
    contaBancaria,
  };
}

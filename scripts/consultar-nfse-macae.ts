/**
 * Consulta SOMENTE-LEITURA das NFS-e já emitidas em Macaé (SPE).
 *
 * - Usa o A1 único da empresa (e-Social).
 * - Chama só ConsultarNfseServicoPrestado (whitelist).
 * - NÃO emite, NÃO cancela, NÃO grava no webservice nem no banco.
 * - Salva amostras em scratch/ (gitignored) para adequar o template.
 *
 * Uso: npx tsx --env-file=.env.local scripts/consultar-nfse-macae.ts
 * Opcional: --de=2025-01-01 --ate=2026-09-23 --pagina=1 --ambiente=producao
 */
import fs from 'fs';
import https from 'https';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/supabase';
import { carregarCertificadoA1 } from '@/lib/certificado-a1';
import { extractKeysFromPfx } from '@/lib/e-social/signing';
import {
  compararComTemplate,
  consultarNfseServicoPrestado,
  garantirOperacaoSomenteLeitura,
  partirPeriodoEmJanelas,
  urlSpeMacae,
  type NfseLida,
} from '@/lib/financeiro/nfse/consulta-somente-leitura';

function arg(nome: string, padrao: string): string {
  const raw = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return raw ? raw.slice(nome.length + 3) : padrao;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function umAnoAtras(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function getMtls(url: string, cert: { pfx: Buffer; passphrase: string }): Promise<{ status: number; body: string }> {
  const u = new URL(url);
  const pem = extractKeysFromPfx(cert.pfx, cert.passphrase);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        key: pem.privateKeyPem,
        cert: pem.certPem,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      (res) => {
        const pedacos: Buffer[] = [];
        res.on('data', (c) => pedacos.push(c));
        res.on('end', () => resolve({ status: res.statusCode || 500, body: Buffer.concat(pedacos).toString('utf8') }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  garantirOperacaoSomenteLeitura('ConsultarNfseServicoPrestado');

  const cert = await carregarCertificadoA1();
  console.log(`A1_UNICO nome=${cert.nome} cn=${cert.subjectCn} validade=${cert.validoAte} fp=${cert.fingerprint.slice(0, 16)}…`);

  const wsdlUrl = `${urlSpeMacae('producao')}?wsdl`;
  try {
    const wsdl = await getMtls(wsdlUrl, cert);
    const out = path.join(process.cwd(), 'scratch', 'nfse-macae-amostras', 'spe-wsdl.xml');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, wsdl.body, 'utf8');
    const ops = [...wsdl.body.matchAll(/<(?:wsdl:)?operation name="([^"]+)"/g)].map((m) => m[1]);
    const msgs = [...wsdl.body.matchAll(/name="(nfseCabecMsg|nfseDadosMsg|inputXML|xml|cabecalho|dados)"/g)].map((m) => m[1]);
    const actions = [...wsdl.body.matchAll(/soapAction="([^"]*)"/g)].map((m) => m[1]);
    const elements = [...wsdl.body.matchAll(/<(?:s:)?element name="([^"]+)"/g)].map((m) => m[1]);
    console.log(`WSDL status=${wsdl.status} bytes=${wsdl.body.length}`);
    console.log(`WSDL_OPS ${[...new Set(ops)].join(',') || '(parse)'}`);
    console.log(`WSDL_PARAMS ${[...new Set(msgs)].join(',') || '?'}`);
    console.log(`WSDL_ACTIONS ${[...new Set(actions)].join(' | ') || '?'}`);
    console.log(`WSDL_ELEMENTS ${[...new Set(elements)].filter((e) => /nfse|Consultar|Cabec|Dados|input/i.test(e)).join(',') || '?'}`);
  } catch (e) {
    console.log('WSDL_LEITURA', e instanceof Error ? e.message : e);
  }

  const { data: empresas, error } = await supabaseAdmin
    .from('payroll_companies')
    .select('id, name, cnpj, inscricao_municipal, municipio_ibge')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const cnpjA1 = (cert.subjectCn.match(/(\d{14})/) || [])[1] || '';
  const empresa = (empresas || []).find((e) => String(e.cnpj || '').replace(/\D/g, '') === cnpjA1);

  const cnpj = cnpjA1 || String(empresa?.cnpj || '');
  const im = empresa?.inscricao_municipal ? String(empresa.inscricao_municipal) : undefined;
  if (!cnpj) {
    console.error('CONSULTA_NFSE_FAIL: CNPJ ausente no A1 e em payroll_companies');
    process.exit(1);
  }
  const de = arg('de', umAnoAtras());
  const ate = arg('ate', hoje());
  const pagina = Number(arg('pagina', '1')) || 1;
  const maxJanelas = Number(arg('max-janelas', '12')) || 12;
  const ambiente = arg('ambiente', 'producao') === 'homologacao' ? 'homologacao' : 'producao';
  const janelas = partirPeriodoEmJanelas(de, ate).slice(0, maxJanelas);

  console.log(`CONSULTA_LEITURA empresa=${empresa?.name || cert.nome} cnpj=${cnpj.replace(/\D/g, '')} im=${im || '(vazia)'} periodo=${de}..${ate} janelas=${janelas.length} ambiente=${ambiente}`);
  console.log('Nenhuma emissão ou alteração será enviada.');

  const outDir = path.join(process.cwd(), 'scratch', 'nfse-macae-amostras');
  fs.mkdirSync(outDir, { recursive: true });

  const todas: NfseLida[] = [];
  let xmlAmostra = '';
  let ultimoErro: { codigo: string; mensagem: string } | undefined;
  let url = '';

  for (const janela of janelas) {
    const resultado = await consultarNfseServicoPrestado(
      { cnpj, inscricaoMunicipal: im, dataInicial: janela.de, dataFinal: janela.ate, pagina, ambiente },
      { pfx: cert.pfx, passphrase: cert.passphrase },
    );
    url = resultado.url;
    const xmlPath = path.join(outDir, `consulta-${ambiente}-${janela.de}_${janela.ate}-p${pagina}.xml`);
    fs.writeFileSync(xmlPath, resultado.xmlResposta, 'utf8');
    if (resultado.erro) {
      ultimoErro = resultado.erro;
      console.log(`JANELA ${janela.de}..${janela.ate} erro=${resultado.erro.codigo} ${resultado.erro.mensagem}`);
      if (/2001|limite/i.test(resultado.erro.mensagem)) break;
      continue;
    }
    console.log(`JANELA ${janela.de}..${janela.ate} notas=${resultado.notas.length}`);
    if (resultado.notas.length > 0 && !xmlAmostra) {
      xmlAmostra = resultado.xmlResposta;
      fs.writeFileSync(path.join(outDir, 'amostra-compnfse.xml'), xmlAmostra, 'utf8');
    }
    todas.push(...resultado.notas);
    if (todas.length >= 20) break;
  }

  if (todas.length === 0) {
    console.log(`CONSULTA_RETORNO ${ultimoErro ? `erro=${ultimoErro.codigo} ${ultimoErro.mensagem}` : 'nenhuma nota no período'}`);
    process.exitCode = 2;
    console.log('CONSULTA_NFSE_LEITURA_PARCIAL');
    return;
  }

  const todasTags = [...new Set(todas.flatMap((n) => n.tagsDeclaracao.length ? n.tagsDeclaracao : n.tags))].sort();
  const diff = compararComTemplate(todasTags);
  const relatorio = {
    somenteLeitura: true,
    operacao: 'ConsultarNfseServicoPrestado',
    url,
    ambiente,
    empresa: empresa?.name || cert.nome,
    periodo: { de, ate, pagina, janelas: janelas.length },
    quantidade: todas.length,
    notas: todas.map(({ tags: _t, discriminacao, ...rest }) => ({
      ...rest,
      discriminacao: discriminacao ? `${discriminacao.slice(0, 80)}…` : undefined,
    })),
    tagsReais: todasTags,
    noRealAusenteNoNosso: diff.noRealAusenteNoNosso,
    noNossoAusenteNoReal: diff.noNossoAusenteNoReal,
  };
  const jsonPath = path.join(outDir, `relatorio-${ambiente}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(relatorio, null, 2), 'utf8');

  console.log(`NOTAS_LIDAS ${todas.length}`);
  for (const n of todas.slice(0, 8)) {
    console.log(`  #${n.numeroNfse || '?'} rps=${n.rpsNumero}/${n.rpsSerie} lc116=${n.itemListaServico} trib=${n.codigoTributacaoMunicipio} iss=${n.exigibilidadeIss} valor=${n.valorServicos}`);
  }
  console.log(`DIFF real-sem-nosso=${diff.noRealAusenteNoNosso.join(',') || '(nenhum)'}`);
  console.log(`DIFF nosso-sem-real=${diff.noNossoAusenteNoReal.join(',') || '(nenhum)'}`);
  console.log(`ARQUIVOS ${outDir} ${jsonPath}`);
  console.log('CONSULTA_NFSE_LEITURA_OK');
}

main().catch((e) => {
  console.error('CONSULTA_NFSE_FAIL', e instanceof Error ? e.message : e);
  process.exit(1);
});

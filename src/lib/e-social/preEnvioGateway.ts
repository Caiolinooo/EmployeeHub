import { generateEventXML, validateEventXML } from '@/services/eSocialService';
import { autoCorrigirDadosEvento, Correcao } from './esocialAutoCorrector';
import { validarDadosEvento, validarXMLGerado, CampoPendente } from './esocialValidator';
import { findFullColaboradorByCpf } from '@/lib/gestao-tripulantes/cpf-lookup';
import {
  corrigirXmlDatasS2220PtBr,
  hidratarExamesDoXmlS2220,
  xmlTemDtExmInvertida,
} from './esocial-date';
import { resolverMatricula } from './esocial-matricula';
import { xmlTemNomeTsInvalido } from './ts-nome';

export { resolverMatricula } from './esocial-matricula';

export interface PreEnvioResult {
  pronto: boolean;
  xml?: string;
  correcoesAplicadas: Correcao[];
  erros: string[];
  camposPendentes: CampoPendente[];
  dadosCorrigidos?: any;
}


export async function validarEPrepararEnvio(evento: any, tpAmb?: number): Promise<PreEnvioResult> {
  const codigoEvento = evento.evento_codigo;
  let dadosOriginais = evento.dados_evento;
  if (!dadosOriginais) dadosOriginais = { dadosEspecificos: {} };
  if (!dadosOriginais.dadosEspecificos) dadosOriginais.dadosEspecificos = {};

  // Garante que o CPF base está disponível no objeto de dados
  const cpfAlvo = evento.cpf_trabalhador || dadosOriginais.cpf || dadosOriginais.cpfTrab;
  if (cpfAlvo) {
    dadosOriginais.cpf = String(cpfAlvo).replace(/\D/g, '');
    dadosOriginais.cpfTrab = dadosOriginais.cpf;
  }
  
  // Garante que CNPJ base está disponível ou fallback para o padrão do Grupo ABZ
  if (!dadosOriginais.cnpj && !dadosOriginais.nrInsc) {
    dadosOriginais.cnpj = evento.cnpj_empregador || '17784306000189';
    dadosOriginais.nrInsc = dadosOriginais.cnpj;
  }

  // Busca dados completos do colaborador na base local de tripulantes se houver CPF
  if (cpfAlvo) {
    try {
      const colab = await findFullColaboradorByCpf(cpfAlvo);
      if (colab) {
        if (!dadosOriginais.nome && !dadosOriginais.nmTrab && colab.nome_completo) {
          dadosOriginais.nome = colab.nome_completo;
          dadosOriginais.nmTrab = colab.nome_completo;
          dadosOriginais.dadosEspecificos.nome = colab.nome_completo;
        }
        if (!dadosOriginais.dataAdmissao && !dadosOriginais.data_admissao && !dadosOriginais.dtAdm) {
          const dtAdm = colab.data_admissao || '2026-01-01';
          dadosOriginais.dataAdmissao = dtAdm;
          dadosOriginais.data_admissao = dtAdm;
          dadosOriginais.dadosEspecificos.dataAdmissao = dtAdm;
          dadosOriginais.dadosEspecificos.data_admissao = dtAdm;
        }
        if (!dadosOriginais.cargo && !dadosOriginais.cargo_nome) {
          const cargo = colab.cargo_nome || colab.funcao || 'Tripulante';
          dadosOriginais.cargo = cargo;
          dadosOriginais.cargo_nome = cargo;
          dadosOriginais.dadosEspecificos.cargo = cargo;
        }
        if (!dadosOriginais.codCBO && !dadosOriginais.cbo && !dadosOriginais.cargo_cbo) {
          const cbo = colab.cbo || colab.cargo_cbo || '215105';
          dadosOriginais.codCBO = cbo;
          dadosOriginais.cbo = cbo;
          dadosOriginais.dadosEspecificos.codCBO = cbo;
        }
        if (!dadosOriginais.matricula && !dadosOriginais.matricula_esocial) {
          const mat = colab.matricula_esocial || colab.matricula || '';
          if (mat) {
            dadosOriginais.matricula = mat;
            dadosOriginais.matricula_esocial = mat;
            dadosOriginais.dadosEspecificos.matricula = mat;
            dadosOriginais.dadosEspecificos.matricula_esocial = mat;
          }
        }
        if ((!dadosOriginais.cnpj || dadosOriginais.cnpj === '17784306000189') && colab.empresa_cnpj) {
          const cnpjLimpo = colab.empresa_cnpj.replace(/\D/g, '');
          if (cnpjLimpo.length >= 8) {
            dadosOriginais.cnpj = cnpjLimpo;
            dadosOriginais.nrInsc = cnpjLimpo;
            dadosOriginais.dadosEspecificos.cnpj = cnpjLimpo;
          }
        }
      }
    } catch (e) {
      console.warn('[eSocial/Gateway] Erro ao buscar colaborador para auto-enriquecimento:', e);
    }
  }

  // Sincroniza matrícula do modelo com os dados se faltar
  const mat = resolverMatricula(evento);
  if (mat) {
    dadosOriginais.matricula = mat;
    dadosOriginais.matricula_esocial = mat;
    dadosOriginais.dadosEspecificos.matricula = mat;
    dadosOriginais.dadosEspecificos.matricula_esocial = mat;
  }

  if (codigoEvento === 'S-2220') {
    hidratarExamesDoXmlS2220(dadosOriginais, evento.xml_gerado);
  }

  // 1. Auto-Correção
  const { dadosCorrigidos, correcoes, xmlPrecisaRebuildar } = autoCorrigirDadosEvento(codigoEvento, dadosOriginais, tpAmb);

  // 2. Validação dos Dados
  const valDados = validarDadosEvento(codigoEvento, dadosCorrigidos);

  if (valDados.erros.some(e => !e.autocorrigivel) || valDados.camposPendentes.length > 0) {
    return {
      pronto: false,
      correcoesAplicadas: correcoes,
      erros: valDados.erros.map(e => e.mensagem),
      camposPendentes: valDados.camposPendentes,
      dadosCorrigidos
    };
  }

  // 3. Rebuild XML se necessário (ou se ainda não existia)
  let xml = evento.xml_gerado;
  let rebuildRealizado = false;

  // Analisa bugs conhecidos que forçam rebuild
  const xmlTemBugAso = xml && codigoEvento === 'S-2220' && /<aso>\s*<resAso>/.test(xml);
  const xmlTemDataInvalida = xml && /\d{4}-(1[3-9]|[2-9]\d)-\d{2}/.test(xml);
  const xmlTemNomeInvalido = Boolean(xml && xmlTemNomeTsInvalido(xml));
  const xmlTemDataExameInvertida = Boolean(xml && codigoEvento === 'S-2220' && xmlTemDtExmInvertida(xml));
  
  // Se o tpAmb do XML estiver diferente do tpAmb requisitado, força rebuild
  const tagAmbienteEsperada = `<tpAmb>${tpAmb}</tpAmb>`;
  const xmlTemAmbErrado = xml && !xml.includes(tagAmbienteEsperada);

  if (!xml || xmlPrecisaRebuildar || xmlTemBugAso || xmlTemDataInvalida || xmlTemAmbErrado || xmlTemNomeInvalido || xmlTemDataExameInvertida) {
    try {
      xml = generateEventXML(codigoEvento, dadosCorrigidos);
      rebuildRealizado = true;
    } catch (e: any) {
      return {
        pronto: false,
        correcoesAplicadas: correcoes,
        erros: [`Erro ao gerar XML: ${e.message}`],
        camposPendentes: [],
        dadosCorrigidos
      };
    }
  }

  if (xml && codigoEvento === 'S-2220') {
    const patched = corrigirXmlDatasS2220PtBr(xml);
    if (patched.alterado) {
      xml = patched.xml;
      correcoes.push({
        campo: 'dtExm',
        de: 'ISO invertido ou MM/DD',
        para: 'YYYY-MM-DD a partir de DD/MM (PT-BR)',
        descricao: 'Datas de exame alinhadas ao padrão brasileiro / dtAso',
      });
    }
  }

  // 4. Validação final do XML
  let valXMLNovo = validarXMLGerado(xml, codigoEvento);
  
  // Se o XML original estava quebrado e ainda não tentamos rebuildar, forçamos um rebuild agora
  if (!valXMLNovo.valido && !rebuildRealizado) {
    try {
      xml = generateEventXML(codigoEvento, dadosCorrigidos);
      rebuildRealizado = true;
      valXMLNovo = validarXMLGerado(xml, codigoEvento);
    } catch (e: any) {
      // Ignora erro do catch para cair na validação normal abaixo
    }
  }

  if (!valXMLNovo.valido) {
    return {
      pronto: false,
      xml,
      correcoesAplicadas: correcoes,
      erros: valXMLNovo.erros.map(e => e.mensagem),
      camposPendentes: [],
      dadosCorrigidos
    };
  }

  // Legado eSocialService validacao (safety net)
  const legacyVal = validateEventXML(xml);
  if (!legacyVal.valido) {
     return {
      pronto: false,
      xml,
      correcoesAplicadas: correcoes,
      erros: legacyVal.erros,
      camposPendentes: [],
      dadosCorrigidos
    };
  }

  return {
    pronto: true,
    xml,
    correcoesAplicadas: correcoes,
    erros: [],
    camposPendentes: [],
    dadosCorrigidos
  };
}

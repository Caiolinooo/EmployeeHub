/**
 * Provider NFS-e ABRASF 2.04 (§5.1 do design).
 * Mesmo ciclo da 2.02 (nfse/abrasf/abrasf202.ts); diferenças tratadas:
 * - lote com versao="2.04" (InfDeclaracaoPrestacaoServico no RPS);
 * - cancelamento com <Pedido><InfPedidoCancelamento Id=…> ASSINADO;
 * - confirmação do cancelamento lida de Confirmacao/Sucesso.
 */
import type { NfseProvider } from '../types';
import type { HttpClient } from '../../banks/http-mtls';
import { criarAbrasf } from './abrasf202';

export const ABRASF204_META: NfseProvider['meta'] = {
  descricao:
    'Webservice municipal padrão ABRASF 2.04 (SOAP, InfDeclaracaoPrestacaoServico, ' +
    'cancelamento com InfPedidoCancelamento assinado).',
  exigeCertificadoA1: true,
  loteMaximo: 1,
};

export interface DepsAbrasf204 {
  http?: HttpClient;
}

export function criarAbrasf204(deps: DepsAbrasf204 = {}): NfseProvider {
  return { ...criarAbrasf({ versao: 204 }, deps), meta: ABRASF204_META };
}

/** Instância padrão 2.04 usada pelo registry. */
export const abrasf204: NfseProvider = criarAbrasf204();

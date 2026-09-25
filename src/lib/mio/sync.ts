/**
 * DEPRECATED (compat shim) — implementação consolidada em
 * `@/lib/gestao-tripulantes/mio-sync` (fluxo único idempotente MIO → portal:
 * colaboradores + treinamentos + embarques + usuários do portal).
 *
 * Mantido apenas para não quebrar `/api/mio/sync` (admin /admin/mio e
 * /admin/integracao-erp). Toda lógica nova deve ir para o módulo consolidado.
 */
import { syncAllFromMIO, syncUsuariosPortal } from '@/lib/gestao-tripulantes/mio-sync';

export {
  emailDomainMatches,
  hostnameMatches,
  isValidNonPlaceholderEmail,
  urlHostnameMatches,
} from './url-host';

export class MioSyncService {
    /**
     * Compat: executa o fluxo consolidado completo (idempotente, sem duplicar)
     * e devolve o shape antigo { success, criados, atualizados, total, erros }.
     */
    async syncEmployees(): Promise<{
        success: boolean;
        criados: number;
        atualizados: number;
        ignorados: number;
        total: number;
        erros: string[];
    }> {
        const r = await syncUsuariosPortal();
        return {
            success: r.success,
            criados: r.criados,
            atualizados: r.atualizados,
            ignorados: r.ignorados,
            total: r.total,
            erros: r.erros
        };
    }

    /** Fluxo consolidado completo (colaboradores + treinamentos + embarques + usuários). */
    async syncCompleto() {
        return syncAllFromMIO();
    }
}

export const mioSyncService = new MioSyncService();

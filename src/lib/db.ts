// Este arquivo foi atualizado para usar apenas o Supabase
// Importar as funções e clientes do Supabase
import { supabase, supabaseAdmin } from './supabase';

// Exportar o cliente Supabase para uso em toda a aplicação
export { supabase, supabaseAdmin };

// Compat de prisma removida. Export mantido apenas para evitar que imports quebrem durante migração.
// Não loga mais em acesso de propriedades internas do React (ex.: $$typeof).
export const prisma: any = new Proxy({}, {
  get: (_target, prop) => {
    // Suprimir verificações internas (React/ESM)
    if (prop === '$$typeof' || prop === '__esModule' || typeof prop === 'symbol') {
      return undefined;
    }
    // Retornar um encadeador que só lança se alguém tentar invocar como função
    const thrower: any = new Proxy(function () {}, {
      get: () => thrower, // permite prisma.x.y.z sem erro até a invocação
      apply: () => { throw new Error('Prisma foi removido. Use Supabase diretamente.'); }
    });
    return thrower;
  }
});

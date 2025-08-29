// Este arquivo foi atualizado para usar apenas o Supabase
// Importar as funções e clientes do Supabase
import { supabase, supabaseAdmin } from './supabase';

// Exportar o cliente Supabase para uso em toda a aplicação
export { supabase, supabaseAdmin };

// Para manter a compatibilidade com o código existente que usa prisma
// Criamos um objeto de compatibilidade que redireciona as chamadas para o Supabase
// NOTA: Este é um objeto temporário para facilitar a migração
// Eventualmente, todo o código deve ser atualizado para usar diretamente o Supabase

// Aviso de depreciação será exibido somente quando o objeto "prisma" for realmente acessado

// Criar um proxy para redirecionar chamadas do Prisma para o Supabase
export const prisma = new Proxy({}, {
  get: function(target, prop) {
    // Registrar tentativa de uso do Prisma apenas em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Tentativa de usar prisma.${String(prop)}. Use supabase diretamente.`);
    }

    // Retornar uma função que registra um erro
    return () => {
      throw new Error(`O Prisma foi removido. Atualize seu código para usar o Supabase diretamente.`);
    };
  }
});

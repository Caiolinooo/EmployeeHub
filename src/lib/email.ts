/**
 * IMPORTANTE: Este arquivo deve ser usado apenas no servidor.
 * Não importe este arquivo diretamente em componentes do cliente.
 * Use src/lib/email-client.ts para componentes do cliente.
 */

// Usar Gmail para todos os ambientes (desenvolvimento e produção)
// Environment configuration loaded securely without logging sensitive data
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log('Email configuration loaded for development environment');
} else {
  console.log('Email configuration loaded for production environment');
}

// Exportar as funções do Gmail
export * from './email-gmail';

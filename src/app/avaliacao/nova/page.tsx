// src/app/avaliacao/nova/page.tsx
import { redirect } from 'next/navigation';

/**
 * PÁGINA DESABILITADA
 * 
 * Avaliações agora são criadas AUTOMATICAMENTE pelo sistema via cron job.
 * Usuários não devem criar avaliações manualmente.
 * 
 * Redirecionando para a lista de avaliações disponíveis.
 */
export default async function NewEvaluationPage() {
  // Redirecionar para lista de avaliações
  redirect('/avaliacao');
}


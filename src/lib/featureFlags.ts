// Centralização de feature flags do sistema
// Uso: import { isFeatureEnabled } from '@/lib/featureFlags';
// Para flags expostas ao cliente use NEXT_PUBLIC_*.

export function isFeatureEnabled(flag: string): boolean {
  switch (flag) {
    case 'avaliacao_weighted_calc':
      return (process.env.EVALUACAO_WEIGHTED_ENABLED === 'true');
    default:
      return false;
  }
}

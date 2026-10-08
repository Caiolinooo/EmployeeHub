import { roleBypassesGate, type GateBypass } from '@/lib/effective-feature';
import { userHasGrant } from '@/lib/effective-permissions-server';

/**
 * Papel (conforme `bypass`) OU algum grant `featureKeys` (feature JSONB / ACL name).
 * O gate nunca remove quem já passava por papel, apenas soma quem recebeu o grant do catálogo vivo.
 */
export async function canWithGrant(
  userId: string | null | undefined,
  role: string | null | undefined,
  featureKeys: readonly string[],
  bypass: GateBypass = 'staff',
): Promise<boolean> {
  if (roleBypassesGate(role, bypass)) return true;
  if (!userId) return false;
  return userHasGrant(userId, featureKeys);
}

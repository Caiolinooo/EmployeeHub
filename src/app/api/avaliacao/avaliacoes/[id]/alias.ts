const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAvaliacaoUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function invalidAvaliacaoIdBody() {
  return {
    success: false as const,
    error: 'ID inválido. O ID deve ser um UUID válido.',
    timestamp: new Date().toISOString(),
  };
}

export async function delegateAvaliacaoById<T>(
  id: string,
  run: () => Promise<T>,
): Promise<{ delegated: true; value: T } | { delegated: false; body: ReturnType<typeof invalidAvaliacaoIdBody> }> {
  if (!isAvaliacaoUuid(id)) {
    return { delegated: false, body: invalidAvaliacaoIdBody() };
  }
  return { delegated: true, value: await run() };
}

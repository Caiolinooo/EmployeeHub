// Stub only: keeps a root `pages/` so Next 15.5 does not compile legacy
// `src/pages/api` (conflicts with `src/app/api`). Never leak env values.
export default function handler(_req, res) {
  res.status(401).json({ error: 'Não autorizado' });
}

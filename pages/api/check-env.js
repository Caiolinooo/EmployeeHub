export default function handler(_req, res) {
  res.status(401).json({ error: 'Não autorizado' });
}

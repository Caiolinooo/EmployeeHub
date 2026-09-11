export function resolverMatricula(evento: any): string {
  if (!evento) return '';
  if (evento.matricula) return String(evento.matricula);
  const raw = evento.dados_evento?.dadosEspecificos || evento.dados_evento || {};
  return raw.matricula_esocial
    || evento.dados_evento?.matricula_esocial
    || raw.matricula
    || evento.dados_evento?.matricula
    || '';
}

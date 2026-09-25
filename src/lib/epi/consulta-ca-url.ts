const CONSULTA_CA_ORIGIN = 'https://consultaca.com';

/**
 * Build the ConsultaCA.com lookup URL from a CA number.
 * Only digits are accepted so user input cannot change the origin or scheme.
 */
export function buildConsultaCaHref(caNumber: string | null | undefined): string | null {
  const digits = String(caNumber ?? '').trim();
  if (!/^\d{1,20}$/.test(digits)) return null;
  return `${CONSULTA_CA_ORIGIN}/${digits}`;
}

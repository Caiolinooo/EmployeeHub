/**
 * Linear XML structure checks for e-Social (CodeQL js/polynomial-redos).
 * Same matches as the previous open-ended tags on realistic S-2220 XML.
 */

const EMPTY_TAG_RE = /<[a-zA-Z0-9]{1,64}>\s{0,80}<\/[a-zA-Z0-9]{1,64}>/;
const ASO_RES_RE = /<aso>\s{0,40}<resAso>/;
const TAG_VALUE_RE = />([^<]{1,80})</;

export function coletarTagsDataXml(xml: string): string[] {
  const dateTagRe =
    /<(dt[A-Z][a-zA-Z0-9]{0,40}|data[a-zA-Z0-9]{0,40})>([^<]{1,80})<\//g;
  return xml.match(dateTagRe) ?? [];
}

export function valorDentroDaTag(tag: string): string | null {
  const m = tag.match(TAG_VALUE_RE);
  return m?.[1] ?? null;
}

export function xmlTemTagsVazias(xml: string): boolean {
  return EMPTY_TAG_RE.test(xml);
}

export function xmlAsoSemDtAsoAntesDeRes(xml: string): boolean {
  return ASO_RES_RE.test(xml);
}

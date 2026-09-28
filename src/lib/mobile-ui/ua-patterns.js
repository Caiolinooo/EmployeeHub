/**
 * Padrões de UA compartilhados: next.config.js (CJS) + testes.
 * Tablet = desktop (mesma regra do middleware: device.type === 'tablet').
 */

const TABLET_UA_SOURCE =
  'iPad|Tablet|PlayBook|SM-T\\d|SM-X\\d|Nexus [79]|Nexus 10|Kindle|Silk|Lenovo TB|Pixel Tablet';

const PHONE_HINT_SOURCE = 'Mobile|iPhone|iPod';

const TABLET_UA_RE = new RegExp(TABLET_UA_SOURCE, 'i');
const PHONE_HINT_RE = new RegExp(PHONE_HINT_SOURCE, 'i');

function isTabletUserAgent(ua) {
  return TABLET_UA_RE.test(String(ua || ''));
}

/** Telefone. Tablet (mesmo com Mobile no UA) = false. */
function isPhoneUserAgent(ua) {
  const s = String(ua || '');
  if (isTabletUserAgent(s)) return false;
  return PHONE_HINT_RE.test(s);
}

/** Regex do rewrite beforeFiles: telefone e não tablet (âncora ^$ — senão casa depois do token tablet). */
const PHONE_REWRITE_UA_VALUE = `^(?<ua>(?!.*(?:${TABLET_UA_SOURCE})).*(?:${PHONE_HINT_SOURCE}).*)$`;

const TABLET_UA_VALUE = `.*(?:${TABLET_UA_SOURCE}).*`;

module.exports = {
  TABLET_UA_SOURCE,
  PHONE_HINT_SOURCE,
  TABLET_UA_RE,
  PHONE_HINT_RE,
  PHONE_REWRITE_UA_VALUE,
  TABLET_UA_VALUE,
  isTabletUserAgent,
  isPhoneUserAgent,
};

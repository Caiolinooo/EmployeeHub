import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDevice,
  decideMobileSurface,
  isMobileImplemented,
  parseSecChUaMobile,
  parseUiCookie,
  isPhoneUserAgent,
  isTabletUserAgent,
  shouldRedirectMobilePrefix,
  stripMobilePrefix,
  toMobileRewritePath,
} from './device-surface';
import { PHONE_REWRITE_UA_VALUE, TABLET_UA_VALUE } from './ua-patterns';
import { readFileSync } from 'node:fs';

describe('parseSecChUaMobile', () => {
  it('reads Chromium ?1 / ?0', () => {
    assert.equal(parseSecChUaMobile('?1'), true);
    assert.equal(parseSecChUaMobile('?0'), false);
    assert.equal(parseSecChUaMobile('1'), true);
    assert.equal(parseSecChUaMobile(null), null);
    assert.equal(parseSecChUaMobile('garbage'), null);
  });
});

describe('classifyDevice', () => {
  it('tablet UA wins over CH mobile', () => {
    assert.equal(classifyDevice({ uaDeviceType: 'tablet', secChUaMobile: '?1' }), 'tablet');
  });
  it('CH mobile without tablet is mobile', () => {
    assert.equal(classifyDevice({ uaDeviceType: undefined, secChUaMobile: '?1' }), 'mobile');
  });
  it('CH desktop is desktop', () => {
    assert.equal(classifyDevice({ uaDeviceType: undefined, secChUaMobile: '?0' }), 'desktop');
  });
  it('UA mobile without CH is mobile', () => {
    assert.equal(classifyDevice({ uaDeviceType: 'mobile' }), 'mobile');
  });
  it('empty UA is desktop', () => {
    assert.equal(classifyDevice({}), 'desktop');
  });
});

describe('allowlist', () => {
  it('only login is implemented in P0', () => {
    assert.equal(isMobileImplemented('/login'), true);
    assert.equal(isMobileImplemented('/login/extra'), true);
    assert.equal(isMobileImplemented('/dashboard'), false);
    assert.equal(isMobileImplemented('/register'), false);
    assert.equal(isMobileImplemented('/ferias'), false);
  });
});

describe('decideMobileSurface', () => {
  const mobileUa = { uaDeviceType: 'mobile' as const };

  it('does not rewrite desktop UA', () => {
    const d = decideMobileSurface({ pathname: '/login', uaDeviceType: undefined });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'desktop');
  });

  it('rewrites mobile UA on allowlisted login', () => {
    const d = decideMobileSurface({ pathname: '/login', ...mobileUa });
    assert.equal(d.rewritePath, '/m/login');
    assert.equal(d.reason, 'ua-mobile');
  });

  it('cookie ui=desktop forces desktop on mobile UA', () => {
    const d = decideMobileSurface({ pathname: '/login', uiCookie: 'desktop', ...mobileUa });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'cookie-desktop');
  });

  it('cookie ui=mobile forces mobile on desktop UA when allowlisted', () => {
    const d = decideMobileSurface({ pathname: '/login', uiCookie: 'mobile', uaDeviceType: undefined });
    assert.equal(d.rewritePath, '/m/login');
    assert.equal(d.reason, 'cookie-mobile');
  });

  it('does not rewrite dashboard even on mobile UA', () => {
    const d = decideMobileSurface({ pathname: '/dashboard', ...mobileUa });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'not-implemented');
  });

  it('tablet defaults to desktop', () => {
    const d = decideMobileSurface({ pathname: '/login', uaDeviceType: 'tablet' });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'tablet-default-desktop');
  });

  it('bots get desktop', () => {
    const d = decideMobileSurface({ pathname: '/login', isBot: true, ...mobileUa });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'bot-desktop');
  });

  it('does not rewrite /m/* again', () => {
    const d = decideMobileSurface({ pathname: '/m/login', ...mobileUa });
    assert.equal(d.rewritePath, null);
    assert.equal(d.reason, 'already-mobile-prefix');
  });

  it('CH mobile rewrites login', () => {
    const d = decideMobileSurface({ pathname: '/login', secChUaMobile: '?1' });
    assert.equal(d.rewritePath, '/m/login');
    assert.equal(d.reason, 'ch-mobile');
  });
});

describe('shouldRedirectMobilePrefix', () => {
  it('lets mobile UA stay on /m/login', () => {
    assert.equal(
      shouldRedirectMobilePrefix({ pathname: '/m/login', uaDeviceType: 'mobile' }),
      false,
    );
  });

  it('redirects desktop UA away from /m/login', () => {
    assert.equal(shouldRedirectMobilePrefix({ pathname: '/m/login' }), true);
  });

  it('never redirects /m/preview', () => {
    assert.equal(shouldRedirectMobilePrefix({ pathname: '/m/preview' }), false);
    assert.equal(
      shouldRedirectMobilePrefix({ pathname: '/m/preview', uaDeviceType: 'mobile' }),
      false,
    );
  });

  it('redirects desktop UA from /m and /m/login to the public URL', () => {
    assert.equal(shouldRedirectMobilePrefix({ pathname: '/m' }), true);
    assert.equal(stripMobilePrefix('/m'), '/');
    assert.equal(stripMobilePrefix('/m/login'), '/login');
    assert.equal(shouldRedirectMobilePrefix({ pathname: '/m', uaDeviceType: 'mobile' }), false);
  });

  it('cookie ui=mobile keeps /m/login on desktop UA', () => {
    assert.equal(
      shouldRedirectMobilePrefix({ pathname: '/m/login', uiCookie: 'mobile' }),
      false,
    );
  });
});

describe('tablet vs phone UA (next.config + middleware)', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const androidPhone =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  const ipad =
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const galaxyTab =
    'Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const galaxyTabMobile =
    'Mozilla/5.0 (Linux; Android 13; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  const nexus7 =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 7 Build/MOB30X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36';
  const desktop =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const pixelTablet =
    'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const kindleSilk =
    'Mozilla/5.0 (Linux; U; Android 4.4.3; en-us; KFTHWI Build/KTU84M) AppleWebKit/537.36 (KHTML, like Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36';
  const lenovoTab =
    'Mozilla/5.0 (Linux; Android 12; Lenovo TB-X606F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const nexus10 =
    'Mozilla/5.0 (Linux; Android 5.1.1; Nexus 10 Build/LMY48T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const playbook =
    'Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0; en-US) AppleWebKit/536.2+ (KHTML, like Gecko) Version/7.2.1.0 Safari/536.2+';
  const tablets = [ipad, galaxyTab, galaxyTabMobile, nexus7, pixelTablet, kindleSilk, lenovoTab, nexus10, playbook];

  it('phones rewrite, tablets and desktop do not', () => {
    assert.equal(isPhoneUserAgent(iphone), true);
    assert.equal(isPhoneUserAgent(androidPhone), true);
    assert.equal(isTabletUserAgent(ipad), true);
    assert.equal(isPhoneUserAgent(ipad), false);
    assert.equal(isTabletUserAgent(galaxyTab), true);
    assert.equal(isPhoneUserAgent(galaxyTab), false);
    assert.equal(isTabletUserAgent(galaxyTabMobile), true);
    assert.equal(isPhoneUserAgent(galaxyTabMobile), false);
    assert.equal(isTabletUserAgent(nexus7), true);
    assert.equal(isPhoneUserAgent(nexus7), false);
    assert.equal(isTabletUserAgent(pixelTablet), true);
    assert.equal(isPhoneUserAgent(pixelTablet), false);
    assert.equal(isTabletUserAgent(kindleSilk), true);
    assert.equal(isPhoneUserAgent(kindleSilk), false);
    assert.equal(isTabletUserAgent(lenovoTab), true);
    assert.equal(isPhoneUserAgent(lenovoTab), false);
    assert.equal(isTabletUserAgent(nexus10), true);
    assert.equal(isPhoneUserAgent(nexus10), false);
    assert.equal(isTabletUserAgent(playbook), true);
    assert.equal(isPhoneUserAgent(playbook), false);
    assert.equal(isPhoneUserAgent(desktop), false);
    assert.equal(isTabletUserAgent(desktop), false);
  });

  it('next.config.js uses the same tablet/phone regex source', () => {
    const cfg = readFileSync(new URL('../../../next.config.js', import.meta.url), 'utf8');
    assert.match(cfg, /PHONE_REWRITE_UA_VALUE/);
    assert.match(cfg, /TABLET_UA_VALUE/);
    assert.match(cfg, /productionMobilePreviewRewrites/);
    assert.equal(typeof PHONE_REWRITE_UA_VALUE, 'string');
    assert.equal(typeof TABLET_UA_VALUE, 'string');
    const phoneRe = new RegExp(PHONE_REWRITE_UA_VALUE);
    const tabletRe = new RegExp(TABLET_UA_VALUE, 'i');
    assert.equal(phoneRe.test(iphone), true);
    assert.equal(phoneRe.test(androidPhone), true);
    assert.equal(phoneRe.test(ipad), false);
    assert.equal(phoneRe.test(galaxyTabMobile), false);
    for (const ua of tablets) {
      assert.equal(phoneRe.test(ua), false, `phone rewrite must miss tablet: ${ua}`);
      assert.equal(tabletRe.test(ua), true, `tablet UA must match: ${ua}`);
    }
    assert.equal(tabletRe.test(iphone), false);
    assert.equal(phoneRe.test(desktop), false);
  });
});

describe('path helpers', () => {
  it('maps public path to /m prefix', () => {
    assert.equal(toMobileRewritePath('/login'), '/m/login');
    assert.equal(stripMobilePrefix('/m/login'), '/login');
    assert.equal(stripMobilePrefix('/m'), '/');
    assert.equal(parseUiCookie('desktop'), 'desktop');
    assert.equal(parseUiCookie('nope'), undefined);
  });
});

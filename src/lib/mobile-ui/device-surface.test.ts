import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDevice,
  decideMobileSurface,
  isMobileImplemented,
  parseSecChUaMobile,
  parseUiCookie,
  shouldRedirectMobilePrefix,
  stripMobilePrefix,
  toMobileRewritePath,
} from './device-surface';

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

  it('cookie ui=mobile keeps /m/login on desktop UA', () => {
    assert.equal(
      shouldRedirectMobilePrefix({ pathname: '/m/login', uiCookie: 'mobile' }),
      false,
    );
  });
});

describe('path helpers', () => {
  it('maps public path to /m prefix', () => {
    assert.equal(toMobileRewritePath('/login'), '/m/login');
    assert.equal(stripMobilePrefix('/m/login'), '/login');
    assert.equal(parseUiCookie('desktop'), 'desktop');
    assert.equal(parseUiCookie('nope'), undefined);
  });
});

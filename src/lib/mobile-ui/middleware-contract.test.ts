import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decideMobileSurface, shouldRedirectMobilePrefix } from './device-surface';

const middlewareSource = fs.readFileSync(path.join(process.cwd(), 'middleware.ts'), 'utf8');

describe('root middleware contract', () => {
  it('keeps the production matcher that excludes /api and static assets', () => {
    assert.ok(
      middlewareSource.includes(
        "'/((?!api|_next/static|_next/image|_next/data|favicon.ico|public|images|fonts|documentos).*)'"
      )
    );
  });

  it('keeps mobile public routes and applyMobileSurface', () => {
    assert.match(middlewareSource, /applyMobileSurface/);
    assert.match(middlewareSource, /isAuthPassthroughPath/);
    assert.match(middlewareSource, /isAvaliacaoPagePath/);
    assert.match(middlewareSource, /x-abz-middleware/);
    assert.match(middlewareSource, /Do not rewrite abzToken/);
    assert.doesNotMatch(middlewareSource, /maxAge: 60 \* 60 \* 24/);
    assert.doesNotMatch(middlewareSource, /from '\.\/lib\/mobile-ui/);
  });

  it('does not redirect public login or locale-only traffic', () => {
    const desktopLogin = decideMobileSurface({
      pathname: '/login',
      uiCookie: undefined,
      secChUaMobile: '?0',
      uaDeviceType: undefined,
      isBot: false,
    });
    assert.equal(desktopLogin.rewritePath, null);
    assert.equal(desktopLogin.reason, 'desktop');

    const cookieDesktop = decideMobileSurface({
      pathname: '/login',
      uiCookie: 'desktop',
      secChUaMobile: '?1',
      uaDeviceType: 'mobile',
      isBot: false,
    });
    assert.equal(cookieDesktop.rewritePath, null);
    assert.equal(cookieDesktop.reason, 'cookie-desktop');

    const cookieMobile = decideMobileSurface({
      pathname: '/login',
      uiCookie: 'mobile',
      uaDeviceType: undefined,
      isBot: false,
    });
    assert.equal(cookieMobile.rewritePath, '/m/login');

    const phone = decideMobileSurface({
      pathname: '/login',
      uaDeviceType: 'mobile',
      isBot: false,
    });
    assert.equal(phone.rewritePath, '/m/login');

    const tablet = decideMobileSurface({
      pathname: '/login',
      uaDeviceType: 'tablet',
      isBot: false,
    });
    assert.equal(tablet.rewritePath, null);
    assert.equal(tablet.reason, 'tablet-default-desktop');

    const dashboard = decideMobileSurface({
      pathname: '/dashboard',
      uaDeviceType: 'mobile',
      isBot: false,
    });
    assert.equal(dashboard.rewritePath, null);
    assert.equal(dashboard.reason, 'not-implemented');
  });

  it('sends desktop UA away from /m/login unless cookie ui=mobile', () => {
    assert.equal(
      shouldRedirectMobilePrefix({ pathname: '/m/login', uaDeviceType: undefined }),
      true
    );
    assert.equal(
      shouldRedirectMobilePrefix({
        pathname: '/m/login',
        uiCookie: 'mobile',
        uaDeviceType: undefined,
      }),
      false
    );
  });
});

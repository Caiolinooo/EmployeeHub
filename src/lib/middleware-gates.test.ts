import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliacaoLegacyRedirect,
  classifyMiddlewarePath,
  isAvaliacaoPagePath,
  isAuthPassthroughPath,
  isExcludedByMiddlewareMatcher,
  isListaPresencaPublicPath,
  isPublicPagePath,
  isStaticAssetPath,
} from './middleware-gates';

describe('middleware matcher', () => {
  it('excludes api, static Next assets, and public file prefixes', () => {
    assert.equal(isExcludedByMiddlewareMatcher('/api/auth/login'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/api/auth/register-supabase'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/api/document-catalog'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/_next/static/chunks/app.js'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/_next/image'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/_next/data/build/dashboard.json'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/favicon.ico'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/public/logo.png'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/images/logo.png'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/fonts/inter.woff2'), true);
    assert.equal(isExcludedByMiddlewareMatcher('/documentos/manual.pdf'), true);
  });

  it('runs middleware on pages, login flow, and non-static _next', () => {
    for (const path of [
      '/',
      '/login',
      '/register',
      '/set-password',
      '/reset-password',
      '/verify-email',
      '/avaliacao',
      '/avaliacao/ver/1',
      '/avaliacoes-avancadas',
      '/lista-presenca/public/abc',
      '/dashboard',
      '/department/gestao-tripulantes',
      '/_next/webpack-hmr',
    ]) {
      assert.equal(isExcludedByMiddlewareMatcher(path), false, path);
    }
  });
});

describe('middleware public / static / lista-presenca', () => {
  it('treats login, register, set-password, reset and verify-email as public pages', () => {
    assert.equal(isPublicPagePath('/login'), true);
    assert.equal(isPublicPagePath('/register'), true);
    assert.equal(isPublicPagePath('/set-password'), true);
    assert.equal(isPublicPagePath('/reset-password'), true);
    assert.equal(isPublicPagePath('/verify-email'), true);
    assert.equal(isPublicPagePath('/dashboard'), false);
  });

  it('passes lista-presenca public links and static prefixes', () => {
    assert.equal(isListaPresencaPublicPath('/lista-presenca/public/link-1'), true);
    assert.equal(isListaPresencaPublicPath('/lista-presenca'), false);
    assert.equal(isStaticAssetPath('/_next/webpack-hmr'), true);
    assert.equal(isAuthPassthroughPath('/lista-presenca/public/link-1'), true);
    assert.equal(isAuthPassthroughPath('/api/auth/login-password'), true);
  });
});

describe('avaliacao path boundary', () => {
  it('does not treat /avaliacoes-avancadas as /avaliacao', () => {
    assert.equal(isAvaliacaoPagePath('/avaliacao'), true);
    assert.equal(isAvaliacaoPagePath('/avaliacao/ver/uuid'), true);
    assert.equal(isAvaliacaoPagePath('/avaliacao/lixeira'), true);
    assert.equal(isAvaliacaoPagePath('/avaliacoes-avancadas'), false);
    assert.equal(isAvaliacaoPagePath('/avaliacoes-avancadas/configuracoes'), false);
    assert.equal(isAvaliacaoPagePath('/avaliacao-desempenho'), false);
  });

  it('keeps the four legacy /avaliacao redirects', () => {
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/avaliacoes'), '/avaliacao');
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/avaliacoes/'), '/avaliacao');
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/lista-avaliacoes'), '/avaliacao');
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/nova-avaliacao'), '/avaliacao');
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/avaliacoes/lixeira'), '/avaliacao/lixeira');
    assert.equal(avaliacaoLegacyRedirect('/avaliacao/ver/1'), null);
    assert.equal(avaliacaoLegacyRedirect('/avaliacoes-avancadas'), null);
  });
});

describe('middleware branches', () => {
  it('never login-redirects public or static paths even without a token', () => {
    const publicPaths = [
      '/login',
      '/register',
      '/set-password',
      '/reset-password',
      '/lista-presenca/public/abc',
      '/_next/webpack-hmr',
      '/images/x.png',
    ];
    for (const path of publicPaths) {
      const branch = classifyMiddlewarePath(path, false);
      assert.ok(
        branch === 'passthrough' || branch === 'matcher-excluded',
        `${path} → ${branch}`
      );
    }
  });

  it('gates only /avaliacao pages; other app routes stay locale-only', () => {
    assert.equal(classifyMiddlewarePath('/avaliacao', false), 'avaliacao-login-redirect');
    assert.equal(classifyMiddlewarePath('/avaliacao/ver/1', true), 'avaliacao-allow');
    assert.equal(
      classifyMiddlewarePath('/avaliacao/avaliacoes', false),
      'avaliacao-legacy-redirect'
    );
    assert.equal(classifyMiddlewarePath('/avaliacoes-avancadas', false), 'locale-only');
    assert.equal(classifyMiddlewarePath('/dashboard', false), 'locale-only');
    assert.equal(classifyMiddlewarePath('/department/gestao-tripulantes', true), 'locale-only');
    assert.equal(classifyMiddlewarePath('/login', false), 'passthrough');
    assert.equal(classifyMiddlewarePath('/api/auth/login', false), 'matcher-excluded');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hostnameEqualsOrSuffix,
  normalizeEndpoint,
  resolveLlmFetchUrl,
  UnsafeUrlError,
} from './llm-endpoint';

describe('hostnameEqualsOrSuffix', () => {
  it('matches exact host and dotted suffix only', () => {
    assert.equal(hostnameEqualsOrSuffix('generativelanguage.googleapis.com', 'generativelanguage.googleapis.com'), true);
    assert.equal(
      hostnameEqualsOrSuffix('west.generativelanguage.googleapis.com', 'generativelanguage.googleapis.com'),
      true,
    );
    assert.equal(
      hostnameEqualsOrSuffix('evilgenerativelanguage.googleapis.com', 'generativelanguage.googleapis.com'),
      false,
    );
    assert.equal(
      hostnameEqualsOrSuffix('generativelanguage.googleapis.com.evil.com', 'generativelanguage.googleapis.com'),
      false,
    );
  });
});

describe('normalizeEndpoint', () => {
  it('appends Gemini OpenAI path only when the hostname matches', () => {
    assert.equal(
      normalizeEndpoint('https://generativelanguage.googleapis.com'),
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
    assert.equal(
      normalizeEndpoint('https://generativelanguage.googleapis.com/v1beta'),
      'https://generativelanguage.googleapis.com/v1beta/openai',
    );
    assert.equal(
      normalizeEndpoint('https://api.openai.com/v1'),
      'https://api.openai.com/v1',
    );
  });

  it('does not treat a substring in path or query as the Gemini host', () => {
    assert.equal(
      normalizeEndpoint('https://evil.example/generativelanguage.googleapis.com'),
      'https://evil.example/generativelanguage.googleapis.com',
    );
    assert.equal(
      normalizeEndpoint('https://evil.example/?q=generativelanguage.googleapis.com'),
      'https://evil.example/?q=generativelanguage.googleapis.com',
    );
  });
});

describe('resolveLlmFetchUrl', () => {
  it('joins a public https endpoint', () => {
    const url = resolveLlmFetchUrl('https://api.openai.com/v1', 'models');
    assert.equal(url.href, 'https://api.openai.com/v1/models');
  });

  it('rejects private, loopback and metadata hosts', () => {
    for (const raw of [
      'http://127.0.0.1:1234/v1',
      'http://localhost:1234/v1',
      'http://10.0.0.5/v1',
      'http://169.254.169.254/latest/meta-data',
      'http://192.168.1.9/v1',
    ]) {
      assert.throws(() => resolveLlmFetchUrl(raw, 'models'), UnsafeUrlError);
    }
  });

  it('rejects credentials and non-http schemes', () => {
    assert.throws(
      () => resolveLlmFetchUrl('https://user:pass@api.openai.com/v1', 'models'),
      UnsafeUrlError,
    );
    assert.throws(() => resolveLlmFetchUrl('javascript:alert(1)', 'models'), UnsafeUrlError);
    assert.throws(() => resolveLlmFetchUrl('file:///etc/passwd', 'models'), UnsafeUrlError);
  });
});

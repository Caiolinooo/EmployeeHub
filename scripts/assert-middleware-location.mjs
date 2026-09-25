#!/usr/bin/env node
/**
 * Fail if Next.js would look for middleware.ts in a directory that does not
 * contain it. Root `pages/` (or `app/`) makes findDir prefer ./pages over
 * ./src/pages, and Next 15.5 searches middleware in path.join(pagesDir, '..').
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findPagesDir } = require('next/dist/lib/find-pages-dir');

const cwd = process.cwd();
const { pagesDir, appDir } = findPagesDir(cwd);
const searchDir = path.join(pagesDir || appDir, '..');
const files = fs.readdirSync(searchDir);
const middlewareFile = files.find((file) => /^middleware\.(ts|js|tsx|jsx)$/.test(file));

if (!middlewareFile) {
  console.error('MIDDLEWARE_LOCATION_FAIL');
  console.error(
    JSON.stringify(
      {
        pagesDir,
        appDir,
        middlewareSearchDir: searchDir,
        hint: 'Remove root pages/ or app/ so Next searches src/, or place middleware.ts next to the winning pagesDir parent.',
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log('MIDDLEWARE_LOCATION_OK', path.join(searchDir, middlewareFile));

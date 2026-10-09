#!/usr/bin/env node
// Copies the shared site menu and footer into every page.
//
//   node scripts/sync-layout.mjs          update pages from scripts/partials/
//   node scripts/sync-layout.mjs --check  only report pages that are out of date (exit code 1)
//
// Each page marks the shared blocks with <!-- shared:<name> ... --> and <!-- /shared:<name> -->.
// In the partials, {{root}} becomes the path back to the site root ("./" or "../").

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTIALS = ['nav', 'footer'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'scripts']);
const checkOnly = process.argv.includes('--check');
// GitHub Pages serves 404.html at whatever address was missing, so its links must be root-relative
const ROOT_OVERRIDES = { '404.html': '/' };

const partials = Object.fromEntries(
    PARTIALS.map((name) => [name, readFileSync(join(SITE_ROOT, 'scripts', 'partials', `${name}.html`), 'utf8').trimEnd()]),
);

function findPages(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            return SKIP_DIRS.has(entry.name) ? [] : findPages(path);
        }
        return entry.name.endsWith('.html') ? [path] : [];
    });
}

function render(name, root, indent) {
    return partials[name]
        .replaceAll('{{root}}', root)
        .split('\n')
        .map((line) => (line ? indent + line : line))
        .join('\n');
}

const stale = [];
const unmarked = [];

for (const page of findPages(SITE_ROOT)) {
    const rel = relative(SITE_ROOT, page);
    const depth = rel.split(sep).length - 1;
    const root = ROOT_OVERRIDES[rel] ?? (depth ? '../'.repeat(depth) : './');
    const source = readFileSync(page, 'utf8');
    let output = source;

    for (const name of PARTIALS) {
        const block = new RegExp(`([ \\t]*)(<!-- shared:${name}\\b[^>]*-->\\n)[\\s\\S]*?\\n([ \\t]*<!-- /shared:${name} -->)`);
        if (!block.test(output)) {
            unmarked.push(`${rel} (${name})`);
            continue;
        }
        output = output.replace(block, (_, indent, open, close) => `${indent}${open}${render(name, root, indent)}\n${close}`);
    }

    if (output !== source) {
        stale.push(rel);
        if (!checkOnly) {
            writeFileSync(page, output);
        }
    }
}

if (unmarked.length) {
    console.warn(`No shared markers in:\n  ${unmarked.join('\n  ')}`);
}

if (checkOnly) {
    if (stale.length) {
        console.error(`Out of date, run node scripts/sync-layout.mjs:\n  ${stale.join('\n  ')}`);
        process.exit(1);
    }
    console.log('All pages match the shared menu and footer.');
} else {
    console.log(stale.length ? `Updated ${stale.length} page(s):\n  ${stale.join('\n  ')}` : 'All pages already up to date.');
}

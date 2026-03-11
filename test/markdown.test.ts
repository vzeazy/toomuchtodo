import test from 'node:test';
import assert from 'node:assert/strict';
import { getMarkdownExcerpt } from '../src/lib/markdown';

test('getMarkdownExcerpt preserves hyphens inside urls and uuids while stripping markdown syntax', () => {
  const value = [
    '# Heading',
    '- bullet item',
    'Visit https://example-site.test/path-name',
    'Reference id `abc-123-def`',
    '```ts',
    'const slug = "keep-hyphenated";',
    '```',
  ].join('\n');

  const excerpt = getMarkdownExcerpt(value, 300);

  assert.match(excerpt, /example-site\.test\/path-name/);
  assert.match(excerpt, /abc-123-def/);
  assert.match(excerpt, /keep-hyphenated/);
  assert.ok(!excerpt.includes('#'));
  assert.ok(!excerpt.includes('```'));
});

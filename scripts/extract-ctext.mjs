/**
 * ctext.org wiki 章节页 → 纯文本提取
 *   node scripts/extract-ctext.mjs docs/corpus/<slug>
 * 读 <slug>/raw/*.html（wiki.pl?chapter=N 存档），取每行 <tr class="result">
 * 的末个 <td class="ctext">（首格为行号），剥标签、解实体，逐行写
 * <slug>/text/<同名>.txt。转录内容不做任何改字。
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('用法: node scripts/extract-ctext.mjs docs/corpus/<slug>');
  process.exit(1);
}
const rawDir = path.join(dir, 'raw');
const textDir = path.join(dir, 'text');
mkdirSync(textDir, { recursive: true });

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

function extract(html) {
  const lines = [];
  for (const row of html.matchAll(/<tr class="result"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...row[1].matchAll(/<td class="ctext"[^>]*>([\s\S]*?)<\/td>/g)];
    if (!tds.length) continue;
    const cell = decodeEntities(tds[tds.length - 1][1].replace(/<[^>]+>/g, ''));
    const t = cell.trim();
    if (t) lines.push(t);
  }
  return lines;
}

for (const f of readdirSync(rawDir).filter((f) => f.endsWith('.html') && f !== 'res.html').sort()) {
  const lines = extract(readFileSync(path.join(rawDir, f), 'utf8'));
  const out = f.replace(/\.html$/, '.txt');
  writeFileSync(path.join(textDir, out), lines.join('\n') + '\n', 'utf8');
  console.log(`${out}: ${lines.length} 行`);
}

/**
 * ctext.org 章节页抓取（礼貌限速）
 *   node scripts/fetch-ctext.mjs [--force]
 * 《奇門遁甲秘笈大全》wiki res=953105 全部章节 → docs/corpus/qmmj/raw/*.html
 * 已存在的文件默认跳过（断点续抓），--force 全量重下。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rawDir = path.join(root, 'docs/corpus/qmmj/raw');
mkdirSync(rawDir, { recursive: true });

const force = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DELAY_MS = 3000;

/** res=953105 目录页解析所得章节表（2026-07 抓取） */
const CHAPTERS = [
  { file: 'res.html', url: 'https://ctext.org/wiki.pl?if=gb&res=953105&remap=gb' },
  { file: '00-xu.html', chapter: 665347, title: '序' },
  { file: '01-juan01.html', chapter: 235555, title: '卷一' },
  { file: '02-juan02.html', chapter: 254334, title: '卷二' },
  { file: '03-juan03.html', chapter: 156941, title: '卷三' },
  { file: '04-juan04.html', chapter: 772362, title: '卷四' },
  { file: '05-juan05.html', chapter: 727053, title: '卷五' },
  { file: '06-juan06.html', chapter: 925522, title: '卷六' },
  { file: '07-juan07.html', chapter: 828124, title: '卷七' },
  { file: '08-juan08.html', chapter: 642938, title: '卷八' },
  { file: '09-juan09.html', chapter: 652391, title: '卷九' },
  { file: '10-juan10.html', chapter: 86117, title: '卷十' },
  { file: '11-juan11.html', chapter: 292676, title: '卷十一' },
  { file: '12-juan12.html', chapter: 71521, title: '卷十二' },
  { file: '13-juan13.html', chapter: 841572, title: '卷十三' },
  { file: '14-juan14.html', chapter: 890559, title: '卷十四' },
  { file: '15-juan15.html', chapter: 65471, title: '卷十五' },
  { file: '16-juan16.html', chapter: 139827, title: '卷十六' },
  { file: '17-juan17.html', chapter: 230213, title: '卷十七' },
  { file: '18-juan18.html', chapter: 554347, title: '卷十八' },
  { file: '19-juan19.html', chapter: 392358, title: '卷十九' },
  { file: '20-juan20.html', chapter: 703617, title: '卷二十' },
  { file: '21-juan21.html', chapter: 961040, title: '卷二十一' },
  { file: '22-juan22.html', chapter: 799331, title: '卷二十二' },
  { file: '23-juan23.html', chapter: 890588, title: '卷二十三' },
  { file: '24-juan24.html', chapter: 52799, title: '卷二十四' },
  { file: '25-juan25.html', chapter: 889554, title: '卷二十五' },
  { file: '26-juan26.html', chapter: 75305, title: '卷二十六' },
  { file: '27-juan27.html', chapter: 830570, title: '卷二十七' },
  { file: '28-juan28.html', chapter: 624967, title: '卷二十八' },
  { file: '29-juan29.html', chapter: 91342, title: '卷二十九' },
  { file: '30-juan30.html', chapter: 822601, title: '卷三十' },
  { file: '31-jhyj01.html', chapter: 496054, title: '諸葛武侯行兵遁甲金函玉鏡卷一' },
  { file: '32-jhyj06.html', chapter: 477359, title: '諸葛武侯行兵遁甲金函玉鏡卷六' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fetched = 0;
let skipped = 0;
for (const c of CHAPTERS) {
  const out = path.join(rawDir, c.file);
  if (!force && existsSync(out)) {
    skipped++;
    continue;
  }
  const url = c.url ?? `https://ctext.org/wiki.pl?if=gb&chapter=${c.chapter}&remap=gb`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' } });
  if (!res.ok) {
    console.error(`✗ ${c.file}: HTTP ${res.status}`);
    process.exit(1);
  }
  const html = await res.text();
  // ctext 转录页正文行标志；缺失说明被限流或页面异常
  if (c.chapter && !html.includes('class="result"')) {
    console.error(`✗ ${c.file}: 页面无转录正文（可能被限流），中止`);
    writeFileSync(out + '.err', html, 'utf8');
    process.exit(1);
  }
  writeFileSync(out, html, 'utf8');
  fetched++;
  console.log(`✓ ${c.file}  ${(html.length / 1024).toFixed(0)}KB  ${c.title ?? '目录页'}`);
  await sleep(DELAY_MS);
}
console.log(`完成：新抓 ${fetched}，跳过 ${skipped}（共 ${CHAPTERS.length}）`);

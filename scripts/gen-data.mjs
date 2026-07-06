/**
 * 语料生成（奇门遁甲典籍语料库；书目见 CHAPTERS 注册表）
 *   docs/corpus/qmmj/text/*.txt（ctext 转录提取稿）
 *   → src/data/docs-manifest.json （全库篇目：path 带 slug 前缀，携 book/dynasty）
 *   → src/data/docs-qmmj.json     （markdown 载荷，按书分包懒加载）
 *   → src/data/sections.json      （节级目录：全库小节索引，深度结构化主产物）
 *   → docs/structured/qmmj/*.md   （人读版结构化 markdown，与载荷同源）
 *
 * 首册：《奇門遁甲秘笈大全》三十卷（旧题明·刘伯温辑，ctext.org wiki res=953105，
 * 简体转录），附《諸葛武侯行兵遁甲金函玉鏡》残卷（卷一、卷六）。
 *
 * 结构化口径：本书为汇编体操作手册，节题皆为无标点独立短行（占目/克应/歌诀/
 * 七十二局/符箓/数占…）。经全量短行聚类核对（604 类），除 DENY 清单外的
 * 2–14 字无标点独行均判为节题；版面碎片/落款/注文行入 DENY 照录为段落，
 * 不臆断重构，不改字。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const textDir = path.join(root, 'docs/corpus/qmmj/text');
const outDir = path.join(root, 'src/data');
const structuredDir = path.join(root, 'docs/structured/qmmj');
mkdirSync(outDir, { recursive: true });

const PROVENANCE =
  '> 底本：ctext.org wiki res=953105 转录《奇門遁甲秘笈大全》（旧题明·刘伯温辑，简体转录本）。';
const PROVENANCE_JHYJ =
  '> 底本：ctext.org wiki res=953105 转录《奇門遁甲秘笈大全》附《諸葛武侯行兵遁甲金函玉鏡》残卷（旧题蜀·诸葛亮撰，简体转录本）。';

/** 节题候选：2–14 字、无标点独行 */
const HEAD_RE = /^[^，。：；、？！?!「」『』（）()·\s]{2,14}$/;
/** 纯干支/地支连串（表行防误判，防御性） */
const RUN_RE = /^([子丑寅卯辰巳午未申酉戌亥]{4,}|[甲乙丙丁戊己庚辛壬癸]{4,})$/;
/** 已核对的非节题短行（版面碎片/落款/注文/表行），照录为段落 */
const DENY = new Set([
  '岁次', // 序落款首行
  '逐日轮算周而复始', // 卷十一 人专煞贡起例注行
  '原文缺', // 底本残缺占位
  '天禽星寄于', '坤宫甲辰壬', // 卷二十九 奇门地盘图断行碎片
  '申青龙酉明堂戌天刑亥朱雀', '巳玄武辰天牢卯玉堂寅白虎', // 金函玉镜 黄黑道表行
  '中五', // 排山掌图注碎片
  '此与三德方同', // 十二局天门地户返闭立成图注行
  '大耗七馀同', // 起神煞例注行
]);
/** 版面衬行（书题重复行），直接跳过 */
const FURNITURE_RE = /^(序奇门遁甲|诸葛武侯行兵遁甲金函玉镜)$/;

const juanCn = (n) => {
  const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) return n === 10 ? '十' : CN[n];
  if (n < 20) return `十${CN[n - 10]}`;
  if (n % 10 === 0) return `${CN[n / 10]}十`;
  return `${CN[Math.floor(n / 10)]}十${CN[n % 10]}`;
};

/** 章节注册表 */
const CHAPTERS = [
  { file: '00-xu.txt', path: 'qmmj/book/xu.md', juan: '序', h1: '奇门遁甲秘笈大全 序' },
  ...Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    const nn = String(n).padStart(2, '0');
    return {
      file: `${nn}-juan${nn}.txt`,
      path: `qmmj/book/juan${nn}.md`,
      juan: `卷${juanCn(n)}`,
      h1: `奇门遁甲秘笈大全 卷${juanCn(n)}`,
    };
  }),
  {
    file: '31-jhyj01.txt', path: 'qmmj/book/jhyj01.md', juan: '金函玉镜卷一',
    h1: '诸葛武侯行兵遁甲金函玉镜 卷一（附）', jhyj: true,
  },
  {
    file: '32-jhyj06.txt', path: 'qmmj/book/jhyj06.md', juan: '金函玉镜卷六',
    h1: '诸葛武侯行兵遁甲金函玉镜 卷六（附）', jhyj: true,
  },
];

const manifest = [];
const sections = [];
const docs = {};
let orderSeq = 0;

for (const ch of CHAPTERS) {
  const lines = readFileSync(path.join(textDir, ch.file), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const body = [];
  const secTitles = [];
  for (const line of lines) {
    if (FURNITURE_RE.test(line)) continue;
    if (HEAD_RE.test(line) && !DENY.has(line) && !RUN_RE.test(line)) {
      body.push(`## ${line}`);
      secTitles.push(line);
      sections.push({ docPath: ch.path, juan: ch.juan, title: line, order: ++orderSeq });
      continue;
    }
    body.push(line);
  }
  if (!body.length) {
    console.error(`✗ ${ch.file} 内容为空`);
    process.exit(1);
  }

  const md = [`# ${ch.h1}`, '', ch.jhyj ? PROVENANCE_JHYJ : PROVENANCE, '', body.join('\n\n')].join('\n');
  docs[ch.path] = md;

  const title =
    secTitles.length > 0
      ? `${ch.juan} · ${secTitles[0]}${secTitles.length > 1 ? `（${secTitles.length}节）` : ''}`
      : ch.juan;
  manifest.push({
    path: ch.path,
    title,
    group: 'book',
    book: ch.jhyj ? '金函玉镜（附）' : '奇门遁甲秘笈大全',
    dynasty: ch.jhyj ? '蜀（旧题）' : '明',
    author: ch.jhyj ? '旧题蜀·诸葛亮' : '旧题明·刘伯温辑',
  });
  console.log(`${ch.path}: ${(md.length / 1024).toFixed(0)}KB，${secTitles.length} 节`);
}

// ---------- 校验 ----------
if (manifest.length !== 33) {
  console.error(`✗ 篇目数 ${manifest.length} ≠ 33`);
  process.exit(1);
}
if (sections.length < 500) {
  console.error(`✗ 节数 ${sections.length} 异常偏少（预期 ≥500）`);
  process.exit(1);
}
const dup = sections.filter((s, i) => i && sections[i - 1].docPath === s.docPath && sections[i - 1].title === s.title);
if (dup.length) console.log(`提示：同卷相邻同名节 ${dup.length} 处（照录）`);

// ---------- 落盘 ----------
writeFileSync(path.join(outDir, 'docs-manifest.json'), JSON.stringify({ manifest }, null, 1), 'utf8');
writeFileSync(path.join(outDir, 'docs-qmmj.json'), JSON.stringify({ docs }, null, 1), 'utf8');
writeFileSync(path.join(outDir, 'sections.json'), JSON.stringify({ sections }, null, 1), 'utf8');

// 人读版结构化 markdown（与载荷同源，存 docs/structured/）
mkdirSync(structuredDir, { recursive: true });
for (const [p, md] of Object.entries(docs)) {
  writeFileSync(path.join(structuredDir, path.basename(p)), md, 'utf8');
}

const total = Object.values(docs).reduce((s, d) => s + d.length, 0);
console.log(`docs-manifest.json: ${manifest.length} 篇；sections.json: ${sections.length} 节；载荷 ${(total / 1024).toFixed(0)}KB`);

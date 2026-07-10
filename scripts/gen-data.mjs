/**
 * 语料生成（奇门遁甲典籍语料库；书目见 CHAPTERS 与 NEW_BOOKS 注册表）
 *   docs/corpus/<slug>/text/*.txt（qmmj 为 ctext 转录；余书为维基文库转录，
 *   经 scripts/fetch-wikisource.mjs 抓取清洗）
 *   → src/data/docs-manifest.json （全库篇目：path 带 slug 前缀，携 book/dynasty）
 *   → src/data/docs-<slug>.json   （markdown 载荷，按书分包懒加载）
 *   → src/data/sections.json      （节级目录：全库小节索引，深度结构化主产物）
 *   → docs/structured/<slug>/*.md （人读版结构化 markdown，与载荷同源）
 *
 * 在册书目：
 *   qmmj 《奇門遁甲秘笈大全》三十卷（旧题明·刘伯温辑）附《金函玉鏡》残卷
 *   dyyy 《遁甲演義》四卷（明·程道生，四庫全書本，繁体）
 *   tz   《奇門遁甲統宗》（明代汇编；卷之四～九局图表底本即略）
 *   bj   《奇门宝鉴（御定）》（清御定汇编，页题唐·徐道符）
 *
 * 结构化口径：诸书均为汇编体，节题为无标点独立短行（dyyy 的节题出自四庫本
 * {{SK anchor}} 锚点）。除各书 DENY 清单外的 2–14 字无标点独行判为节题；
 * 版面碎片/引文导语/韵文误立行入 DENY 照录为段落，不臆断重构，不改字。
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
/** 合并星值时节题特例（卷十八「天蓬、天芮星值辰时」式，顿号并题） */
const COMBINED_STAR_HEAD_RE = /^天[蓬芮冲辅禽心柱任英](、天[蓬芮冲辅禽心柱任英])+星值[子丑寅卯辰巳午未申酉戌亥]时$/;
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
    if ((HEAD_RE.test(line) || COMBINED_STAR_HEAD_RE.test(line)) && !DENY.has(line) && !RUN_RE.test(line)) {
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

// ═══════════════ 维基文库续册（NEW_BOOKS 注册表；文本约定与 qmmj 一致） ═══════════════
const NEW_BOOKS = [
  {
    slug: 'dyyy',
    book: '遁甲演義（四庫全書本）',
    dynasty: '明',
    author: '明·程道生',
    provenance:
      '> 底本：维基文库《遁甲演義》四庫全書本（明·程道生撰，繁体）转录；SKQS 罕字已按平行转录本与渲染字形核定回填（对照表见 scripts/fetch-wikisource.mjs SKCHAR）。',
    // 引文导语/换行断片/韵文行（四庫本扫描行宽断行所致），照录为段落
    deny: new Set([
      '以授時厯看審訂太陽過', '宫方可選用大衝天馬方', '術曰', '呪曰', '玉女咒曰', '右禹罡呪訖',
      '經曰緩則從門急則從神', '當行玉女反閉之法以全億萬軍人', '若午日即從午上命上第一籌',
      '牛入兎園食甘草', '猛虎逡巡入巳位', '兎入牛欄伏不起', '龍入馬廏因留止', '蛇行宛轉來申裏',
      '祝曰維', '甲子旬', '三元經曰初出天門', '凡出行百惡不敢起大吉',
    ]),
    minSections: 80,
    chapters: [1, 2, 3, 4].map((n) => ({
      file: `0${n}-juan${n}.txt`,
      path: `dyyy/book/juan${n}.md`,
      juan: `卷${juanCn(n)}`,
      h1: `遁甲演義 卷${juanCn(n)}`,
    })),
  },
  {
    slug: 'tz',
    book: '奇門遁甲統宗',
    dynasty: '明',
    author: '佚名（明代汇编）',
    provenance: '> 底本：维基文库《奇門遁甲統宗》（明代汇编，简体转录；卷之四～九为阴阳十八局图表，底本即略）。',
    deny: new Set([]),
    minSections: 35,
    chapters: [
      { file: '01-juanshou.txt', path: 'tz/book/juanshou.md', juan: '卷首', h1: '奇門遁甲統宗 卷首（序·源流·凡例·目录）' },
      ...[['02-juan01', '一'], ['03-juan02', '二'], ['04-juan03', '三'], ['05-juan10', '十'], ['06-juan11', '十一'], ['07-juan12', '十二']].map(
        ([f, cn]) => ({ file: `${f}.txt`, path: `tz/book/${f.slice(3)}.md`, juan: `卷之${cn}`, h1: `奇門遁甲統宗 卷之${cn}` }),
      ),
    ],
  },
  {
    slug: 'bj',
    book: '奇门宝鉴（御定）',
    dynasty: '清',
    author: '清敕撰汇编（页题唐·徐道符）',
    provenance: '> 底本：维基文库《奇门宝鉴御定》（清御定汇编，页题唐·徐道符，简体转录）。释义四十四则以【释…】括题分节。',
    deny: new Set([]),
    minSections: 45,
    chapters: [{ file: '01-full.txt', path: 'bj/book/full.md', juan: '全帙', h1: '奇门宝鉴（御定）' }],
  },
];

for (const nb of NEW_BOOKS) {
  const nbTextDir = path.join(root, `docs/corpus/${nb.slug}/text`);
  const nbStructuredDir = path.join(root, `docs/structured/${nb.slug}`);
  mkdirSync(nbStructuredDir, { recursive: true });
  const nbDocs = {};
  let nbSections = 0;

  for (const ch of nb.chapters) {
    const lines = readFileSync(path.join(nbTextDir, ch.file), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const body = [];
    const secTitles = [];
    for (const line of lines) {
      if (HEAD_RE.test(line) && !nb.deny.has(line) && !RUN_RE.test(line)) {
        body.push(`## ${line}`);
        secTitles.push(line);
        sections.push({ docPath: ch.path, juan: ch.juan, title: line, order: ++orderSeq });
        continue;
      }
      body.push(line);
    }
    if (!body.length) {
      console.error(`✗ ${nb.slug}/${ch.file} 内容为空`);
      process.exit(1);
    }

    const md = [`# ${ch.h1}`, '', nb.provenance, '', body.join('\n\n')].join('\n');
    nbDocs[ch.path] = md;
    nbSections += secTitles.length;

    manifest.push({
      path: ch.path,
      title: secTitles.length ? `${ch.juan} · ${secTitles[0]}${secTitles.length > 1 ? `（${secTitles.length}节）` : ''}` : ch.juan,
      group: 'book',
      book: nb.book,
      dynasty: nb.dynasty,
      author: nb.author,
    });
    console.log(`${ch.path}: ${(md.length / 1024).toFixed(0)}KB，${secTitles.length} 节`);
    writeFileSync(path.join(nbStructuredDir, path.basename(ch.path)), md, 'utf8');
  }

  if (nbSections < nb.minSections) {
    console.error(`✗ ${nb.slug} 节数 ${nbSections} < ${nb.minSections}`);
    process.exit(1);
  }
  writeFileSync(path.join(outDir, `docs-${nb.slug}.json`), JSON.stringify({ docs: nbDocs }, null, 1), 'utf8');
}

// ---------- 校验 ----------
const EXPECT_DOCS = 33 + NEW_BOOKS.reduce((s, b) => s + b.chapters.length, 0);
if (manifest.length !== EXPECT_DOCS) {
  console.error(`✗ 篇目数 ${manifest.length} ≠ ${EXPECT_DOCS}`);
  process.exit(1);
}
if (sections.length < 700) {
  console.error(`✗ 节数 ${sections.length} 异常偏少（预期 ≥700）`);
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
console.log(`docs-manifest.json: ${manifest.length} 篇；sections.json: ${sections.length} 节；qmmj 载荷 ${(total / 1024).toFixed(0)}KB`);

// ═══════════════ 盘面克应库（keying.json）：盘面要素 → 原文断语 ═══════════════
// 深度结构化分支：十干克应 / 八门静·动应 / 九星总断与值时 / 三奇到宫 /
// 八神应验 / 吉凶格局与标记歌诀 / 七十二局吉格。均携 docPath 供典籍深链。
{
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const GATES = '开休生伤杜景死惊';
  const STARS = '蓬芮冲辅禽心柱任英';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const TRIG = '乾坎艮震巽离坤兑';
  const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const cnToInt = (s) => {
    if (s.includes('十')) {
      const [a, b = ''] = s.split('十');
      return (a ? CN_NUM[a] : 1) * 10 + (b ? CN_NUM[b] : 0);
    }
    return CN_NUM[s];
  };
  const readLines = (f) =>
    readFileSync(path.join(textDir, f), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  /** 取 startRe 命中行（含）到 endRe 命中行（不含）的行段 */
  const slice = (lines, startRe, endRe) => {
    const i = lines.findIndex((l) => startRe.test(l));
    if (i < 0) return [];
    let j = lines.length;
    for (let k = i + 1; k < lines.length; k++) {
      if (endRe.test(lines[k])) { j = k; break; }
    }
    return lines.slice(i, j);
  };
  const issues = [];

  // ---------- 1. 十干克应（卷二）：天盘干加地盘干 → 格名+断语；段尾「时加六仪」独立成时干格 ----------
  const shiGan = [];
  const shiJiaGe = []; // 时加六仪：时干 → 断语
  {
    const seg = slice(readLines('02-juan02.txt'), /^十干克应诀$/, /^天蓬星$/).slice(1);
    let tian = null;
    let cur = null;
    let hourMode = false;
    for (const line of seg) {
      // 段尾块：「时加六甲，…」按时干成条
      const hj = line.match(new RegExp(`^时加六([${GAN}])(.*)$`));
      if (hj) {
        hourMode = true;
        cur = { gan: hj[1], text: [hj[2].replace(/^[，。\s]+/, '')] };
        shiJiaGe.push(cur);
        continue;
      }
      if (hourMode) {
        cur?.text.push(line);
        continue;
      }
      // 组头：「六甲同六戊」/「六乙…」→ 天盘干（甲遁戊，组内以戊行盘）
      const grp = line.match(new RegExp(`^六([${GAN}])(?:同六([${GAN}]))?`));
      // 全式条目：「戊加戊…谓之「伏吟」。text」
      const full = line.match(new RegExp(`^([${GAN}])加([${GAN}])(.*)$`));
      // 省式条目：「加乙为…」，含「加日奇六乙/月奇六丙/星奇六丁」变体
      const add = line.match(new RegExp(`^加(?:日奇六|月奇六|星奇六)?([${GAN}])(.*)$`));
      if (grp && !full) {
        tian = grp[2] ?? grp[1];
        cur = null;
        continue;
      }
      if (full) {
        tian = full[1];
        cur = { tian, di: full[2], text: [full[3].trim()] };
        shiGan.push(cur);
        continue;
      }
      if (add && tian) {
        cur = { tian, di: add[1], text: [add[2].trim()] };
        shiGan.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
      else issues.push(`十干克应散行: ${line.slice(0, 18)}`);
    }
    for (const e of shiGan) {
      const m = e.text.join(' ').match(/[「『]([^」』]{2,8})[」』]/);
      if (m) e.name = m[1];
      e.text = e.text.join('\n').replace(/^[，。：、\s]+/, '');
    }
    for (const e of shiJiaGe) e.text = e.text.join('\n');
  }

  // ---------- 2. 八门克应（卷四开休生 + 卷五伤杜景死惊）：总论/静应/动应 ----------
  const menZong = [];
  const menYing = []; // { gate, on, kind: '门'|'奇仪', mode: '静'|'动', text }
  for (const [file, dp] of [['04-juan04.txt', 'qmmj/book/juan04.md'], ['05-juan05.txt', 'qmmj/book/juan05.md']]) {
    const lines = readLines(file);
    let gate = null;
    let mode = null; // null=总论区
    let zong = null;
    let cur = null;
    for (const line of lines) {
      const g = line.match(new RegExp(`^([${GATES}])门克应$`));
      if (g) {
        gate = `${g[1]}门`;
        mode = null;
        zong = { gate, text: [], docPath: dp };
        menZong.push(zong);
        cur = null;
        continue;
      }
      if (/^静应$/.test(line)) { mode = '静'; cur = null; continue; }
      if (/^动应$/.test(line)) { mode = '动'; cur = null; continue; }
      if (!gate) continue; // 门区之前的内容（总目等）
      if (mode === null) {
        // 换节离开当前门（如「八门克应诀总目」后接其他节题）
        if (new RegExp(`^[^，。：；、]{1,12}$`).test(line) && !line.startsWith('问曰') && line.length <= 12 && !new RegExp(`[${GAN}${GATES}]门?[：:]`).test(line) && !/^(问曰|答曰)/.test(line) && menZong.at(-1) !== zong) {
          continue;
        }
        zong?.text.push(line);
        continue;
      }
      // 静/动应条目：「开门加开：…」「加休：…」「加甲戊：…」
      const m = line.match(new RegExp(`^(?:([${GATES}])门)?加(甲戊|[${GAN}]|[${GATES}])门?[：:](.*)$`));
      if (m) {
        const on = m[2];
        const kind = GATES.includes(on) ? '门' : '奇仪';
        cur = { gate, on: kind === '门' ? `${on}门` : on, kind, mode, text: [m[3].trim()], docPath: dp };
        menYing.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
      else zong?.text.push(line); // 静应节内先导散文归总论
    }
  }
  for (const e of [...menZong, ...menYing]) e.text = e.text.join('\n');

  // ---------- 3. 九星总断（卷二：蓬芮冲；卷三：辅禽心柱任英） + 九星值时（卷十七） ----------
  const xingZong = [];
  {
    const bounds = new RegExp(`^天([${STARS}])星$`);
    for (const [file, dp] of [['02-juan02.txt', 'qmmj/book/juan02.md'], ['03-juan03.txt', 'qmmj/book/juan03.md']]) {
      let cur = null;
      for (const line of readLines(file)) {
        const m = line.match(bounds);
        if (m) {
          cur = { star: `天${m[1]}`, text: [], docPath: dp };
          xingZong.push(cur);
          continue;
        }
        if (cur) cur.text.push(line);
      }
    }
    for (const e of xingZong) e.text = e.text.join('\n');
  }
  const xingShi = [];
  {
    // 单星题与合并星题（「天蓬、天芮星值辰时」共文，按星各出一条）
    const head = new RegExp(`^(天[${STARS}](?:、天[${STARS}])*)星值([${ZHI}])时$`);
    for (const [file, dp] of [['17-juan17.txt', 'qmmj/book/juan17.md'], ['18-juan18.txt', 'qmmj/book/juan18.md']]) {
      let curGroup = null; // { stars, hourZhi, text }
      const flush = () => {
        if (!curGroup) return;
        const text = curGroup.text.join('\n');
        for (const s of curGroup.stars) {
          xingShi.push({ star: s, hourZhi: curGroup.hourZhi, text, docPath: dp, ...(curGroup.stars.length > 1 ? { shared: true } : {}) });
        }
        curGroup = null;
      };
      for (const line of readLines(file)) {
        const m = line.match(head);
        if (m) {
          flush();
          curGroup = { stars: m[1].split('、').map((s) => (s.startsWith('天') ? s : `天${s}`)), hourZhi: m[2], text: [] };
          continue;
        }
        if (curGroup) {
          if (/^[^，。：；、]{1,12}$/.test(line)) { flush(); continue; }
          curGroup.text.push(line);
        }
      }
      flush();
    }
  }

  // ---------- 4. 三奇到宫（卷十七 三奇到宫断；卷四 三奇到宫克应吉凶 同式并入） ----------
  const sanQiGong = [];
  for (const [file, startRe, dp] of [
    ['17-juan17.txt', /^三奇到宫断$/, 'qmmj/book/juan17.md'],
    ['04-juan04.txt', /^三奇到宫克应吉凶$/, 'qmmj/book/juan04.md'],
  ]) {
    const seg = slice(readLines(file), startRe, /^[^，。：；、]{1,12}$/).slice(1);
    let cur = null;
    for (const line of seg) {
      const m = line.match(new RegExp(`^六([乙丙丁])(?:奇)?到([${TRIG}])`));
      if (m) {
        cur = { qi: m[1], trigram: m[2], text: [line], docPath: dp };
        sanQiGong.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
    }
  }
  for (const e of sanQiGong) {
    const m = e.text[0].match(/名[曰为][「『]([^」』]{2,10})[」』]/);
    if (m) e.name = m[1];
    e.text = e.text.join('\n');
  }

  // ---------- 5. 八神应验（卷十六） ----------
  const baShen = [];
  {
    const seg = slice(readLines('16-juan16.txt'), /^八神应验$/, /^[^，。：；、]{1,10}$/).slice(1);
    for (const line of seg) {
      const m = line.match(/^(值符|螣蛇|腾蛇|太阴|六合|白虎|玄武|元武|九地|九天|勾陈|朱雀)/);
      // 归一：螣蛇→腾蛇；元武（避讳写法）→玄武
      if (m) baShen.push({ god: m[1] === '螣蛇' ? '腾蛇' : m[1] === '元武' ? '玄武' : m[1], text: line });
      else if (baShen.length) baShen.at(-1).text += `\n${line}`;
    }
  }

  // ---------- 6. 吉凶格局（卷十五）+ 标记歌诀 ----------
  const geju = [];
  {
    const lines = readLines('15-juan15.txt');
    for (const [startRe, kind] of [
      [/^奇门吉格$/, '吉'],
      [/^三奇贵人升殿格$/, '吉'],
      [/^凶格$/, '凶'],
    ]) {
      const seg = slice(lines, startRe, /^(奇门吉格|三奇贵人升殿格|凶格|门迫歌|三奇入墓歌|十二宫神歌)$/).slice(1);
      let cur = null;
      for (const line of seg) {
        const m = line.match(/^[「『]([^」』]{1,12})[」』]/);
        if (m) {
          cur = { name: m[1], kind, text: [line] };
          geju.push(cur);
          continue;
        }
        if (cur) cur.text.push(line);
      }
    }
    // 三奇贵人升殿格节题本身即一格（节内无引号名时兜底）
    for (const e of geju) e.text = e.text.join('\n');
  }
  const markVerses = [];
  {
    const lines = readLines('15-juan15.txt');
    for (const [re, mark] of [
      [/^门迫歌$/, '门迫'],
      [/^三奇入墓歌$/, '入墓'],
    ]) {
      const seg = slice(lines, re, /^[^，。：；、]{1,10}$/).slice(1);
      if (seg.length) markVerses.push({ mark, text: seg.join('\n') });
    }
  }

  // ---------- 6.5 多书互证：同格多书断语 ----------
  // 《遁甲演義》卷二（格局逐节，繁体）/《統宗》卷之一「奇门四十格」（格名+构成表）/
  // 《宝鉴》释义四十四则（【释X】概念条）→ 与 qmmj 吉凶格局同名者增源并入 geju，
  // docPath 区分书源；未匹配者不并（不臆断跨书对齐）。
  {
    const T2S = {
      飛: '飞', 鳥: '鸟', 龍: '龙', 門: '门', 竒: '奇', 熒: '荧', 雲: '云', 風: '风',
      嵗: '岁', 時: '时', 並: '并', 隂: '阴', 陽: '阳', 儀: '仪', 擊: '击', 網: '网',
    };
    const t2s = (s) => [...s].map((c) => T2S[c] ?? c).join('');
    const stripGe = (s) => s.replace(/格$/, '');
    /** 异名对齐（书间同格异名/略称/异体），值可为多目标 */
    const ALIAS = {
      五不遇: '五不遇时格',
      螣蛇跃蹻: '螣蛇妖矫',
      朱雀入江: '朱雀投江',
      荧入白: '荧惑入太白',
      白入荧: '太白入荧惑',
      大隔: '大格', 刑隔: '刑格', 勃隔: '悖格', 小隔并岁隔月隔日隔时隔: '小格',
      龙回首: '青龙回首格', 鸟跌穴: '飞鸟跌穴', 龙逃走: '青龙逃走', 虎猖狂: '白虎猖狂',
      蛇夭矫: '螣蛇妖矫', 雀投江: '朱雀投江',
      六仪击刑: '六仪刑击格', 天网: '天网四张', 迫: '迫制和义格',
      奇墓奇制与日时干墓同凶: '奇墓格',
      反吟伏吟: ['伏吟格', '反吟格'],
    };
    const byName = new Map(geju.map((e) => [stripGe(e.name), e]));
    const resolveGeju = (raw) => {
      const t = ALIAS[t2s(raw)] ?? t2s(raw);
      return (Array.isArray(t) ? t : [t]).map((n) => byName.get(stripGe(n))).filter(Boolean);
    };
    const cross = [];
    let unmatched = 0;

    /** 通用节切分：HEAD_RE 节题行 → {title, body} */
    const sectionsOf = (file, dir, deny = new Set()) => {
      const out = [];
      let cur = null;
      for (const line of readFileSync(path.join(root, dir, file), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        if (HEAD_RE.test(line) && !deny.has(line) && !RUN_RE.test(line)) {
          cur = { title: line, body: [] };
          out.push(cur);
          continue;
        }
        cur?.body.push(line);
      }
      return out;
    };

    // A. 遁甲演義卷二：格局逐节（歌曰/經曰断语自足）
    const dyyyDeny = NEW_BOOKS.find((b) => b.slug === 'dyyy').deny;
    for (const sec of sectionsOf('02-juan2.txt', 'docs/corpus/dyyy/text', dyyyDeny)) {
      const hits = resolveGeju(sec.title);
      if (!hits.length) { unmatched++; continue; }
      for (const hit of hits) {
        cross.push({ name: hit.name, kind: hit.kind, text: sec.body.join('\n'), docPath: 'dyyy/book/juan2.md' });
      }
    }
    const dyyyN = cross.length;

    // B. 統宗卷之一「奇门四十格」：格名 + 构成条件表
    {
      const lines = readFileSync(path.join(root, 'docs/corpus/tz/text/02-juan01.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const seg = slice(lines, /^奇门四十格$/, /^八节应八门旺相$/).slice(1);
      for (const line of seg) {
        const m = line.match(/^(\S{2,10})\s{2,}(.+)$/);
        if (!m) continue;
        const hits = resolveGeju(m[1]);
        if (!hits.length) { unmatched++; continue; }
        for (const hit of hits) {
          cross.push({ name: hit.name, kind: hit.kind, text: `${m[1]}：${m[2]}`, docPath: 'tz/book/juan01.md' });
        }
      }
    }
    const tzN = cross.length - dyyyN;

    // C. 宝鉴释义四十四则：【释X】概念条
    {
      let cur = null;
      const secs = [];
      for (const line of readFileSync(path.join(root, 'docs/corpus/bj/text/01-full.txt'), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        const m = line.match(/^【[释辨](.+?)】$/);
        if (m) {
          cur = { title: m[1], body: [] };
          secs.push(cur);
          continue;
        }
        if (HEAD_RE.test(line)) { cur = null; continue; } // 出释义区
        cur?.body.push(line);
      }
      for (const sec of secs) {
        const hits = resolveGeju(sec.title);
        if (!hits.length) { unmatched++; continue; }
        for (const hit of hits) {
          cross.push({ name: hit.name, kind: hit.kind, text: sec.body.join('\n'), docPath: 'bj/book/full.md' });
        }
      }
    }
    const bjN = cross.length - dyyyN - tzN;

    geju.push(...cross);
    console.log(`keying/geju 多书互证: +${cross.length} 条（演義 ${dyyyN} / 統宗 ${tzN} / 宝鉴 ${bjN}；未对齐照录原书 ${unmatched} 节）`);
    if (cross.length < 40) {
      console.error(`✗ 多书互证条数 ${cross.length} 异常偏少（预期 ≥40）`);
      process.exit(1);
    }
  }

  // ---------- 7. 七十二局吉格（卷二十九）：奇+星+门组合 ----------
  const ju72 = [];
  {
    const lines = readLines('29-juan29.txt');
    const head = /^第([一二三四五六七八九十]{1,3})局$/;
    let cur = null;
    for (const line of lines) {
      const m = line.match(head);
      if (m) {
        cur = { no: cnToInt(m[1]), text: [] };
        ju72.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
    }
    // 首句「X奇同[神、]星临Y门[遇…日时]，号曰「名」」：神/星次序不定、或缺星，分量独立提取
    const GOD_RE = /(值符|直符|九天|九地|太阴|六合|白虎|玄武|元武|朱雀|螣蛇|腾蛇|勾陈)/;
    const normGod = (g) => (g === '直符' ? '值符' : g === '螣蛇' ? '腾蛇' : g === '元武' ? '玄武' : g);
    for (const e of ju72) {
      const first = e.text[0] ?? '';
      const head = first.split(/号曰/)[0];
      const qi = head.match(/^([乙丙丁])奇/);
      if (qi) e.qi = qi[1];
      const g = head.match(new RegExp(`([${GATES}])门`));
      if (g) e.gate = `${g[1]}门`;
      const s = head.match(new RegExp(`(?:天)?([${STARS}])星`));
      if (s) e.star = `天${s[1]}`;
      const sh = head.match(GOD_RE);
      if (sh) e.god = normGod(sh[1]);
      const n = first.match(/号曰[「『]([^」』]{2,10})[」』]/);
      if (n) e.name = n[1];
      e.text = e.text.join('\n');
    }
  }

  // ---------- 校验与落盘 ----------
  const check = (label, arr, min) => {
    console.log(`keying/${label}: ${arr.length} 条`);
    if (arr.length < min) {
      console.error(`✗ keying/${label} ${arr.length} < ${min}`);
      process.exit(1);
    }
  };
  check('shiGan 十干克应', shiGan, 80);
  check('shiJiaGe 时加六仪', shiJiaGe, 10);
  check('menZong 八门总论', menZong, 8);
  check('menYing 门静动应', menYing, 100);
  check('xingZong 九星总断', xingZong, 9);
  check('xingShi 九星值时', xingShi, 90);
  check('sanQiGong 三奇到宫', sanQiGong, 20);
  check('baShen 八神应验', baShen, 8);
  check('geju 吉凶格局', geju, 12);
  check('markVerses 标记歌诀', markVerses, 2);
  check('ju72 七十二局', ju72, 72);
  if (ju72.length !== 72) {
    console.error(`✗ 七十二局数 ${ju72.length} ≠ 72`);
    process.exit(1);
  }
  const ju72Parsed = ju72.filter((e) => e.qi && e.gate).length;
  console.log(`keying/ju72 可解析组合: ${ju72Parsed}/72${issues.length ? `；散行 ${issues.length}` : ''}`);
  if (ju72Parsed < 60) {
    console.error(`✗ ju72 组合解析率过低 ${ju72Parsed}/72`);
    process.exit(1);
  }

  writeFileSync(
    path.join(outDir, 'keying.json'),
    JSON.stringify(
      {
        source:
          'ctext.org res=953105《奇門遁甲秘笈大全》（卷二/四/五/十五/十六/十七/二十九 深度结构化）+ 维基文库《遁甲演義》《奇門遁甲統宗》《奇门宝鉴御定》格局互证（geju 按 docPath 区分书源）',
        shiGan: shiGan.map((e) => ({ ...e, docPath: 'qmmj/book/juan02.md' })),
        shiJiaGe: shiJiaGe.map((e) => ({ ...e, docPath: 'qmmj/book/juan02.md' })),
        menZong,
        menYing,
        xingZong,
        xingShi: xingShi.map((e) => ({ ...e, docPath: 'qmmj/book/juan17.md' })),
        sanQiGong,
        baShen: baShen.map((e) => ({ ...e, docPath: 'qmmj/book/juan16.md' })),
        geju: geju.map((e) => ({ docPath: 'qmmj/book/juan15.md', ...e })), // 互证条目自带书源 docPath，qmmj 原条目回落卷十五
        markVerses: markVerses.map((e) => ({ ...e, docPath: 'qmmj/book/juan15.md' })),
        ju72: ju72.map((e) => ({ ...e, docPath: 'qmmj/book/juan29.md' })),
        textualIssues: issues,
      },
      null,
      1,
    ),
    'utf8',
  );
}

// ═══════════════ 占目库（zhanmu.json）：占类 → 断法原文 ═══════════════
// 深度结构化分支二：
//   卷七~卷十  具体占目（占投军…占立窑，一题一法）
//   卷十一~十四 分类论断（X占 → 论干支/值符/值使/十干/九星/九宫/门户/三甲/吉凶格）
// 宿主按「所占何事」取对应古法喂 AI。家宅占等底本收两套论断，照收不并。
{
  const readLines2 = (f) =>
    readFileSync(path.join(textDir, f), 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const isHead = (l) => HEAD_RE.test(l) && !DENY.has(l) && !RUN_RE.test(l);

  // ---------- 卷七~十：具体占目 ----------
  const zhanMu = [];
  for (const [file, dp] of [
    ['07-juan07.txt', 'qmmj/book/juan07.md'],
    ['08-juan08.txt', 'qmmj/book/juan08.md'],
    ['09-juan09.txt', 'qmmj/book/juan09.md'],
    ['10-juan10.txt', 'qmmj/book/juan10.md'],
  ]) {
    let cur = null;
    for (const line of readLines2(file)) {
      if (isHead(line)) {
        cur = { title: line, text: [], docPath: dp };
        zhanMu.push(cur);
        continue;
      }
      if (cur) cur.text.push(line);
    }
  }
  for (const e of zhanMu) e.text = e.text.join('\n');
  const zhanMuEmpty = zhanMu.filter((e) => !e.text);
  if (zhanMuEmpty.length) {
    console.error('✗ 占目空节:', zhanMuEmpty.map((e) => e.title).join('、'));
    process.exit(1);
  }

  // ---------- 卷十一~十四：分类论断 ----------
  const TOPIC_RE = /^([^，。：；、\s]{1,4})占$/;
  /** 论断方面白名单（含「论/又论/又」前缀变体与免前缀简式；论直使=论值使之讹） */
  const ASPECT_MAP = {
    干支: '干支', 值符: '值符', 值使: '值使', 直使: '值使', 十干: '十干',
    九星: '九星', 九宫: '九宫', 门户: '门户', 三甲: '三甲', 门户三甲: '门户三甲',
    吉凶格: '吉凶格', 吉凶: '吉凶格', 断: '综断', 诀: '诀',
  };
  const aspectOf = (l) => {
    // 「论门户三甲」为卷十三胎产占合并式节题，置于「门户」前优先匹配
    const m = l.match(/^(?:又论|论|又)?(门户三甲|干支|值符|值使|直使|十干|九星|九宫|门户|三甲|吉凶格|吉凶|断|诀)$/);
    return m ? ASPECT_MAP[m[1]] : null;
  };

  const lunDuan = [];
  const topicsSeen = [];
  for (const [file, dp] of [
    ['11-juan11.txt', 'qmmj/book/juan11.md'],
    ['12-juan12.txt', 'qmmj/book/juan12.md'],
    ['13-juan13.txt', 'qmmj/book/juan13.md'],
    ['14-juan14.txt', 'qmmj/book/juan14.md'],
  ]) {
    let topic = null;
    let cur = null;
    for (const line of readLines2(file)) {
      if (!isHead(line)) {
        if (cur) cur.text.push(line);
        continue;
      }
      const t = line.match(TOPIC_RE);
      if (t && !aspectOf(line)) {
        topic = t[1];
        if (!topicsSeen.includes(topic)) topicsSeen.push(topic);
        cur = null;
        continue;
      }
      const aspect = topic ? aspectOf(line) : null;
      if (aspect) {
        cur = { topic, aspect, title: line, text: [], docPath: dp };
        lunDuan.push(cur);
        continue;
      }
      // 非占类非方面的节题（千金诀/禹罡图/论主客…）：脱离当前占类语境
      topic = null;
      cur = null;
    }
  }
  for (const e of lunDuan) e.text = e.text.join('\n');
  const ldEmpty = lunDuan.filter((e) => !e.text);

  // ---------- 校验与落盘 ----------
  console.log(`zhanmu/占目: ${zhanMu.length} 条（卷七~十）`);
  console.log(`zhanmu/分类论断: ${lunDuan.length} 条，占类 ${topicsSeen.length}: ${topicsSeen.join('、')}`);
  if (zhanMu.length < 100) {
    console.error(`✗ 占目数 ${zhanMu.length} < 100`);
    process.exit(1);
  }
  if (topicsSeen.length < 14 || lunDuan.length < 100) {
    console.error(`✗ 分类论断异常: 占类 ${topicsSeen.length}，条目 ${lunDuan.length}`);
    process.exit(1);
  }
  if (ldEmpty.length) {
    console.error('✗ 论断空节:', ldEmpty.map((e) => `${e.topic}·${e.title}`).join('、'));
    process.exit(1);
  }

  writeFileSync(
    path.join(outDir, 'zhanmu.json'),
    JSON.stringify(
      {
        source: 'ctext.org wiki res=953105《奇門遁甲秘笈大全》（卷七~十 占目；卷十一~十四 分类论断）',
        topics: topicsSeen,
        lunDuan,
        zhanMu,
      },
      null,
      1,
    ),
    'utf8',
  );
}

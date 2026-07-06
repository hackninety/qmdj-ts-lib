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
        source: 'ctext.org wiki res=953105《奇門遁甲秘笈大全》（卷二/四/五/十五/十六/十七/二十九 深度结构化）',
        shiGan: shiGan.map((e) => ({ ...e, docPath: 'qmmj/book/juan02.md' })),
        shiJiaGe: shiJiaGe.map((e) => ({ ...e, docPath: 'qmmj/book/juan02.md' })),
        menZong,
        menYing,
        xingZong,
        xingShi: xingShi.map((e) => ({ ...e, docPath: 'qmmj/book/juan17.md' })),
        sanQiGong,
        baShen: baShen.map((e) => ({ ...e, docPath: 'qmmj/book/juan16.md' })),
        geju: geju.map((e) => ({ ...e, docPath: 'qmmj/book/juan15.md' })),
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

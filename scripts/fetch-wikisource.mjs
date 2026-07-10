/**
 * 维基文库抓取器（语料续册）：
 *   《遁甲演義》（四庫全書本，明·程道生，4 卷）
 *   《奇門遁甲統宗》（明代大型汇编，单页全文）
 *   《奇门宝鉴御定》（清御定汇编，单页全文）
 *
 * raw wikitext（?action=raw）→ docs/corpus/<slug>/wikitext/*.wiki（存档）
 * → 按书清洗 → docs/corpus/<slug>/text/*.txt（与 qmmj 转录同一约定：
 *   节题为无标点独立短行，正文按原段落一行一段）。
 *
 * 清洗只做格式转换（模板/标记剥离、SKQS 罕字回填、目录衬行剔除），不改字。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * SKQS 罕字模板 {{SKchar|id}} → 通行字。
 * 每一 id 均经双重核定：维基文库另一转录本《遁甲演義》（单页简体版）平行段
 * 比对 + action=parse 渲染字形核验（如 1841 渲染为「龜」），非按文义臆断。
 * 未收录 id 输出 □ 并在日志提示补录。
 */
const SKCHAR = {
  551: '船', // 「移舟轉向下船開江」（平行本同句作「下船开江」；刻本作異體「舩」）
  1452: '隸', // 分野格式句「至胃初度隸焉」×9（平行本作「隶焉」）
  1841: '龜', // 「七日有烏龜自林中出」「六十日白龜至大發」（渲染字形核验为「龜」）
  1974: '候', // 「氣有天地人三候…七十二候」，四庫本以罕字刻「𠉀」
  2615: '乖', // 「精神恍惚夢寐乖張」（平行本作「梦寐乖张」）
  2616: '拜', // 「登壇拜將欽授兵符」
  2652: '傳', // 十二月將「傳送申」（太乙巳勝光午小吉未傳送申從魁酉，定式）
  2780: '吉', // 「振衣而出吉」（平行本同句；刻本作異體「𠮷」）
  2894: '蚩', // 「軒轅黄帝戰蚩尤涿鹿」
  3951: '揚', // 「九天之上好揚兵」（煙波釣叟歌定句；刻本作異體「敭」）
  // 2029 不收录：北斗隱諱鬼旁罕字（步罡呪「魁…䰢…魓」序列），平行本转录者
  // 亦仅能作「(鬼+○)」构字注，无通行字可回填，保留 □ 占位。
};
const unknownSkchar = new Map();

/** 通用 wikitext 剥离（链接/粗斜体/残余模板） */
function stripWikiCommon(s) {
  return s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1') // [[a|b]] / [[b]] → b
    .replace(/'''?/g, '')
    .replace(/\{\{YL\|([^{}]*)\}\}/g, '$1') // 年号链接模板保留内文
    .replace(/\{\{[^{}|]*\|([^{}]*)\}\}/g, '$1') // 其余带参模板保留末参
    .replace(/\{\{[^{}]*\}\}/g, ''); // 无参模板整体剔除
}

/** 遁甲演義（四庫全書本）：SKQS 模板富文本 → 纯文本；{{SK anchor|节题}} 化为独立节题行 */
function cleanSkqs(wiki) {
  let s = wiki
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{SKQS header[^{}]*\}\}/g, '')
    .replace(/<\/?(?:onlyinclude|poem|includeonly|noinclude)>/g, '')
    .replace(/\{\{SKchar\|(\d+)\}\}/g, (_, id) => {
      if (SKCHAR[id]) return SKCHAR[id];
      unknownSkchar.set(id, (unknownSkchar.get(id) ?? 0) + 1);
      return '□';
    })
    // 节题锚点独立成行（此书结构化的天然依据）
    .replace(/\{\{SK anchor\|([^{}]+)\}\}/g, '\n$1\n');
  s = stripWikiCommon(s);

  const lines = [];
  for (let line of s.split(/\r?\n/)) {
    line = line.replace(/[　\s]+$/g, '').replace(/^[　]+/g, '');
    if (!line) continue;
    if (line === '欽定四庫全書') continue; // 版心衬行
    if (/^遁甲演義卷[一二三四]$/.test(line)) continue; // 卷题（h1 已含），防与节题混淆
    lines.push(line);
  }
  return lines.join('\n');
}

/**
 * 統宗/宝鉴：近纯文本。剥 {{header}} 块与 ==书题== 行；
 * 剔除卷首目录衬行：正文（长句/带句读的行）出现之前，节题样短行若后继
 * 仍是节题样短行则为目录条目，剔除（紧邻正文的真节题保留）。
 */
function cleanPlain(wiki) {
  let s = wiki
    .replace(/\{\{header[\s\S]*?\}\}\s*/i, '')
    .replace(/^==+(.*?)==+\s*$/gm, (_, inner) => (/[《》]/.test(inner.trim()) ? '' : inner.trim()));
  s = stripWikiCommon(s);

  const raw = s
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l) => l.trim());

  const headLike = (l) => /^[^，。：；、？！?!「」『』（）()·\s]{2,14}$/.test(l.trim()) && !/^[　 ]/.test(l);
  const bodyLike = (l) => l.trim().length > 20 || /[，。：；]/.test(l);
  const out = [];
  let seenBody = false;
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!seenBody && headLike(line)) {
      const next = raw[i + 1];
      if (next && headLike(next)) continue; // 目录衬行：后继仍是节题样短行
    }
    if (bodyLike(line)) seenBody = true;
    out.push(line.trim());
  }
  return out.join('\n');
}

const BOOKS = [
  {
    slug: 'dyyy',
    label: '遁甲演義（四庫全書本）',
    clean: cleanSkqs,
    pages: [1, 2, 3, 4].map((n) => ({ title: `遁甲演義 (四庫全書本)/卷${n}`, out: `0${n}-juan${n}` })),
  },
  {
    slug: 'tz',
    label: '奇門遁甲統宗',
    clean: (wiki) => cleanPlain(wiki).replace(/^奇门遁甲统宗\n/, ''), // 首行书题衬行
    pages: [{ title: '奇門遁甲統宗', out: '01-full' }],
    // 底本正文以「奇门遁甲统宗卷之N」裸行分卷（卷之四～九底本注「略」，系局图表卷未转录）
    split: {
      marker: /^奇门遁甲统宗卷之(.+)$/,
      firstOut: '01-juanshou',
      firstTitle: '卷首（序·源流·凡例·目录）',
      outOf: (label) => {
        const m = { 一: '02-juan01', 二: '03-juan02', 三: '04-juan03', 十: '05-juan10', 十一: '06-juan11', 十二: '07-juan12' };
        return m[label.trim()] ?? null; // 「四～九 （略）」等注记行并入下一卷卷首段
      },
    },
  },
  {
    slug: 'bj',
    label: '奇门宝鉴御定',
    clean: cleanPlain,
    pages: [{ title: '奇门宝鉴御定', out: '01-full' }],
  },
];

/** 按分卷标记把整页文本拆为多文件；无法识别的标记行降级为下一卷首段落 */
function splitByMarker(text, split) {
  const lines = text.split('\n');
  const files = [];
  let cur = { out: split.firstOut, lines: [] };
  let pendingNote = null;
  for (const line of lines) {
    const m = line.match(split.marker);
    if (m) {
      const out = split.outOf(m[1]);
      if (out) {
        files.push(cur);
        cur = { out, lines: [] };
        if (pendingNote) {
          cur.lines.push(pendingNote);
          pendingNote = null;
        }
      } else {
        pendingNote = `（底本注：${line}）`;
      }
      continue;
    }
    cur.lines.push(line);
  }
  files.push(cur);
  return files;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRaw(title) {
  const url = `https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(title)}&action=raw`;
  const res = await fetch(url, {
    headers: { 'user-agent': 'qmdj-ts-lib corpus fetcher (github.com/hackninety/qmdj-ts-lib)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${title}`);
  return await res.text();
}

for (const book of BOOKS) {
  const wikiDir = path.join(root, `docs/corpus/${book.slug}/wikitext`);
  const textDir = path.join(root, `docs/corpus/${book.slug}/text`);
  mkdirSync(wikiDir, { recursive: true });
  mkdirSync(textDir, { recursive: true });

  for (const page of book.pages) {
    const wiki = await fetchRaw(page.title);
    writeFileSync(path.join(wikiDir, `${page.out}.wiki`), wiki, 'utf8');
    const text = book.clean(wiki);
    if (book.split) {
      for (const f of splitByMarker(text, book.split)) {
        writeFileSync(path.join(textDir, `${f.out}.txt`), f.lines.join('\n'), 'utf8');
        console.log(`${book.label} → ${f.out}.txt（${(f.lines.join('\n').length / 1024).toFixed(0)}KB）`);
      }
    } else {
      writeFileSync(path.join(textDir, `${page.out}.txt`), text, 'utf8');
      console.log(`${book.label} ${page.title} → ${page.out}.txt（${(text.length / 1024).toFixed(0)}KB）`);
    }
    await sleep(600);
  }
}

if (unknownSkchar.size) {
  console.log('⚠ 未收录 SKchar id（已以 □ 占位，请按上下文补 SKCHAR 表）：');
  for (const [id, n] of unknownSkchar) console.log(`  id=${id} ×${n}`);
}
console.log('维基文库抓取完成。');

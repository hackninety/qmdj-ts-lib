/**
 * 盘面克应检索子入口 —— `import { lookupChart } from 'qmdj-ts-lib/keying'`
 *
 * 深度结构化分支：把《奇門遁甲秘笈大全》中「盘面要素 → 断语」类内容
 * （十干克应/八门静应/九星总断与值时/三奇到宫/八神应验/吉凶格局/七十二局）
 * 编为可按排盘结果直接检索的库。输入结构兼容 react-qimen 统一模型的子集。
 */
import keyingData from './data/keying.json';

// ---------- 数据形状 ----------

interface ShiGanEntry { tian: string; di: string; name?: string; text: string; docPath: string }
interface ShiJiaGeEntry { gan: string; text: string; docPath: string }
interface MenZongEntry { gate: string; text: string; docPath: string }
interface MenYingEntry { gate: string; on: string; kind: '门' | '奇仪'; mode: '静' | '动'; text: string; docPath: string }
interface XingZongEntry { star: string; text: string; docPath: string }
interface XingShiEntry { star: string; hourZhi: string; text: string; docPath: string; shared?: boolean }
interface SanQiGongEntry { qi: string; trigram: string; name?: string; text: string; docPath: string }
interface BaShenEntry { god: string; text: string; docPath: string }
interface GejuEntry { name: string; kind: '吉' | '凶'; text: string; docPath: string }
interface MarkVerseEntry { mark: string; text: string; docPath: string }
interface Ju72Entry { no: number; qi?: string; star?: string; gate?: string; god?: string; name?: string; text: string; docPath: string }

interface KeYingData {
  source: string;
  shiGan: ShiGanEntry[];
  shiJiaGe: ShiJiaGeEntry[];
  menZong: MenZongEntry[];
  menYing: MenYingEntry[];
  xingZong: XingZongEntry[];
  xingShi: XingShiEntry[];
  sanQiGong: SanQiGongEntry[];
  baShen: BaShenEntry[];
  geju: GejuEntry[];
  markVerses: MarkVerseEntry[];
  ju72: Ju72Entry[];
  textualIssues: string[];
}

/** 结构化克应库全量数据 */
export const keying = keyingData as unknown as KeYingData;

// ---------- 盘面检索 ----------

/** 宫位输入（react-qimen PalaceInfo 的结构子集，多余字段忽略） */
export interface ChartPalaceInput {
  gong: number;
  tianPanGan: string[];
  diPanGan: string[];
  star?: string;
  gate?: string;
  god?: string;
}

export interface ChartLookupInput {
  palaces: ChartPalaceInput[];
  /** 时支（值时克应用） */
  hourZhi?: string;
  /** 时干（时加六仪用） */
  hourGan?: string;
  /** 引擎已识别的格局名（吉凶格断语匹配用） */
  patterns?: string[];
  /** 全盘出现过的标记（门迫/入墓 歌诀用） */
  marks?: string[];
}

/** 命中的典籍参考 */
export interface CanonRef {
  kind: '十干克应' | '时加六仪' | '门总断' | '门加门' | '门加奇仪' | '九星' | '九星值时' | '三奇到宫' | '八神' | '格局' | '标记' | '七十二局';
  /** 检索键的展示文本（如「戊+丙」「开门加休门」「天蓬值子时」） */
  key: string;
  /** 关联宫位（全局性条目为空） */
  gong?: number;
  /** 格名 */
  name?: string;
  text: string;
  /** 典籍深链 path（qmmj/book/juanXX.md） */
  docPath: string;
  /** 原文存疑：底本抄本带「俟查」「当须查考」等残注（如七十二局第31/32/52局），引用时应提示 */
  uncertain?: boolean;
}

/** 宫号 → 八卦（洛书） */
const GONG_TRIGRAM: Record<number, string> = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 5: '中', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
/** 八门本位宫（门加门静应：天盘门加地盘本位门） */
const GATE_ORIGINAL: Record<number, string> = { 1: '休门', 8: '生门', 3: '伤门', 4: '杜门', 9: '景门', 2: '死门', 7: '惊门', 6: '开门' };

/** 星名展开：'天芮/天禽'、'禽芮' → ['天芮','天禽'] */
function starTokens(star?: string): string[] {
  if (!star) return [];
  if (star.includes('/')) return star.split('/').map((s) => (s.startsWith('天') ? s : `天${s}`));
  if (star.startsWith('天')) return [star];
  return star.split('').map((c) => `天${c}`);
}

/** 门奇仪键：地盘/天盘干 戊 ↔ 底本「甲戊」并称 */
const ganKey = (g: string) => (g === '戊' ? '甲戊' : g);

/**
 * 按盘面要素检索典籍断语。
 * 命中去重（kind+key+gong），顺序：逐宫（十干克应→门→星→三奇→八神→七十二局）
 * → 值时/时干 → 格局 → 标记歌诀。
 */
/** 底本残注（存疑标记）：命中即标 uncertain，所有类别统一在 push 汇合点判定 */
const UNCERTAIN_RE = /俟查|当须查考|待考|存疑/;

export function lookupChart(input: ChartLookupInput): CanonRef[] {
  const refs: CanonRef[] = [];
  const seen = new Set<string>();
  const push = (r: CanonRef) => {
    const id = `${r.kind}|${r.key}|${r.gong ?? ''}`;
    if (seen.has(id)) return;
    seen.add(id);
    if (UNCERTAIN_RE.test(r.text)) r.uncertain = true;
    refs.push(r);
  };

  for (const p of input.palaces ?? []) {
    const stars = starTokens(p.star);

    // 十干克应：天盘干 × 地盘干
    for (const t of p.tianPanGan) {
      for (const d of p.diPanGan) {
        for (const e of keying.shiGan.filter((e) => e.tian === t && e.di === d)) {
          push({ kind: '十干克应', key: `${t}+${d}`, gong: p.gong, name: e.name, text: e.text, docPath: e.docPath });
        }
      }
    }

    // 门加门（静应）：天盘门 加 地盘本位门
    const baseGate = GATE_ORIGINAL[p.gong];
    if (p.gate && baseGate) {
      for (const e of keying.menYing.filter((e) => e.kind === '门' && e.gate === p.gate && e.on === baseGate)) {
        push({ kind: '门加门', key: `${p.gate}加${baseGate}`, gong: p.gong, text: e.text, docPath: e.docPath });
      }
    }
    // 门加奇仪：门 + 天盘干
    if (p.gate) {
      for (const g of p.tianPanGan) {
        for (const e of keying.menYing.filter((e) => e.kind === '奇仪' && e.gate === p.gate && e.on === ganKey(g))) {
          push({ kind: '门加奇仪', key: `${p.gate}加${ganKey(g)}`, gong: p.gong, text: e.text, docPath: e.docPath });
        }
      }
    }

    // 三奇到宫：乙丙丁落宫
    const trigram = GONG_TRIGRAM[p.gong];
    for (const g of p.tianPanGan) {
      if ('乙丙丁'.includes(g) && trigram) {
        for (const e of keying.sanQiGong.filter((e) => e.qi === g && e.trigram === trigram)) {
          push({ kind: '三奇到宫', key: `${g}奇到${trigram}`, gong: p.gong, name: e.name, text: e.text, docPath: e.docPath });
        }
      }
    }

    // 八神应验
    if (p.god) {
      for (const e of keying.baShen.filter((e) => p.god === e.god || p.god!.includes(e.god))) {
        push({ kind: '八神', key: e.god, gong: p.gong, text: e.text, docPath: e.docPath });
      }
    }

    // 七十二局吉格：奇 + 门（+星/神进一步吻合则优先，宽松按 奇+门+星）
    if (p.gate && stars.length) {
      for (const e of keying.ju72) {
        if (!e.qi || !e.gate) continue;
        if (e.gate !== p.gate) continue;
        if (!p.tianPanGan.includes(e.qi)) continue;
        if (e.star && !stars.includes(e.star)) continue;
        push({ kind: '七十二局', key: `第${e.no}局 ${e.qi}奇${e.star ?? ''}${e.gate}`, gong: p.gong, name: e.name, text: e.text, docPath: e.docPath });
      }
    }
  }

  // 值时克应：各宫星 × 时支（含值符星所值）
  if (input.hourZhi) {
    const allStars = new Set(input.palaces?.flatMap((p) => starTokens(p.star)) ?? []);
    for (const e of keying.xingShi.filter((e) => e.hourZhi === input.hourZhi && allStars.has(e.star))) {
      push({ kind: '九星值时', key: `${e.star}值${e.hourZhi}时`, text: e.text, docPath: e.docPath });
    }
  }

  // 时加六仪：时干
  if (input.hourGan) {
    for (const e of keying.shiJiaGe.filter((e) => e.gan === input.hourGan)) {
      push({ kind: '时加六仪', key: `时加六${e.gan}`, text: e.text, docPath: e.docPath });
    }
  }

  // 格局断语：引擎识别的格局名 ↔ 库内格名/十干克应格名（双向包含）
  for (const name of input.patterns ?? []) {
    const bare = name.replace(/[·。，].*$/, '');
    for (const e of keying.geju) {
      if (bare.includes(e.name) || e.name.includes(bare)) {
        push({ kind: '格局', key: e.name, name: e.name, text: e.text, docPath: e.docPath });
      }
    }
    for (const e of keying.shiGan) {
      if (e.name && (bare.includes(e.name) || e.name.includes(bare))) {
        push({ kind: '十干克应', key: `${e.tian}+${e.di}`, name: e.name, text: e.text, docPath: e.docPath });
      }
    }
  }

  // 标记歌诀：门迫/入墓
  for (const mark of input.marks ?? []) {
    for (const e of keying.markVerses.filter((e) => e.mark === mark)) {
      push({ kind: '标记', key: `${e.mark}歌`, text: e.text, docPath: e.docPath });
    }
  }

  return refs;
}

/** 九星总断（按星取，供星义面板/导出） */
export function getStarLore(star: string): XingZongEntry | undefined {
  const tokens = starTokens(star);
  return keying.xingZong.find((e) => tokens.includes(e.star));
}

/** 八门总论（按门取） */
export function getGateLore(gate: string): MenZongEntry | undefined {
  return keying.menZong.find((e) => e.gate === gate);
}

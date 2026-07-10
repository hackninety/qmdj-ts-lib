interface ShiGanEntry {
    tian: string;
    di: string;
    name?: string;
    text: string;
    docPath: string;
}
interface ShiJiaGeEntry {
    gan: string;
    text: string;
    docPath: string;
}
interface MenZongEntry {
    gate: string;
    text: string;
    docPath: string;
}
interface MenYingEntry {
    gate: string;
    on: string;
    kind: '门' | '奇仪';
    mode: '静' | '动';
    text: string;
    docPath: string;
}
interface XingZongEntry {
    star: string;
    text: string;
    docPath: string;
}
interface XingShiEntry {
    star: string;
    hourZhi: string;
    text: string;
    docPath: string;
    shared?: boolean;
}
interface SanQiGongEntry {
    qi: string;
    trigram: string;
    name?: string;
    text: string;
    docPath: string;
}
interface BaShenEntry {
    god: string;
    text: string;
    docPath: string;
}
interface GejuEntry {
    name: string;
    kind: '吉' | '凶';
    text: string;
    docPath: string;
}
interface MarkVerseEntry {
    mark: string;
    text: string;
    docPath: string;
}
interface Ju72Entry {
    no: number;
    qi?: string;
    star?: string;
    gate?: string;
    god?: string;
    name?: string;
    text: string;
    docPath: string;
}
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
export declare const keying: KeYingData;
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
export declare function lookupChart(input: ChartLookupInput): CanonRef[];
/** 九星总断（按星取，供星义面板/导出） */
export declare function getStarLore(star: string): XingZongEntry | undefined;
/** 八门总论（按门取） */
export declare function getGateLore(gate: string): MenZongEntry | undefined;
export {};

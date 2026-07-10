import { describe, expect, it } from 'vitest';
import { getGateLore, getStarLore, keying, lookupChart } from '../keying';

describe('克应库数据完整性', () => {
  it('各分支条数达标', () => {
    expect(keying.shiGan.length).toBeGreaterThanOrEqual(80);
    expect(keying.shiJiaGe).toHaveLength(10);
    expect(keying.menZong).toHaveLength(8);
    expect(keying.menYing.length).toBeGreaterThanOrEqual(190);
    expect(keying.xingZong).toHaveLength(9);
    expect(keying.xingShi).toHaveLength(108); // 9 星 × 12 时
    expect(keying.sanQiGong.length).toBeGreaterThanOrEqual(24);
    expect(keying.baShen).toHaveLength(8);
    expect(keying.geju.length).toBeGreaterThanOrEqual(50);
    expect(keying.ju72).toHaveLength(72);
  });

  it('十干克应含经典格名', () => {
    const qlfs = keying.shiGan.find((e) => e.name === '青龙返首');
    expect(qlfs).toBeDefined();
    expect(qlfs?.tian).toBe('戊');
    expect(qlfs?.di).toBe('丙');
    const fntx = keying.shiGan.find((e) => e.name?.includes('飞鸟') || e.name?.includes('跌穴'));
    expect(fntx?.tian).toBe('丙');
  });

  it('九星值时覆盖全部星×时组合', () => {
    const combos = new Set(keying.xingShi.map((e) => `${e.star}|${e.hourZhi}`));
    expect(combos.size).toBe(108);
  });

  it('星/门总断可按名取', () => {
    expect(getStarLore('天蓬')?.text).toContain('天蓬');
    expect(getStarLore('禽芮')?.star).toMatch(/天[禽芮]/);
    expect(getGateLore('开门')?.text).toContain('开门');
  });
});

describe('lookupChart 盘面检索', () => {
  // 基准盘 2024-06-15 14:30 阳遁六局 的真实宫位子集
  const palaces = [
    { gong: 1, tianPanGan: ['庚'], diPanGan: ['壬'], star: '天任', gate: '休门', god: '六合' },
    { gong: 2, tianPanGan: ['己'], diPanGan: ['乙', '癸'], star: '天柱', gate: '死门', god: '值符' },
    { gong: 6, tianPanGan: ['壬'], diPanGan: ['戊'], star: '天蓬', gate: '开门', god: '太阴' },
    { gong: 9, tianPanGan: ['乙', '癸'], diPanGan: ['辛'], star: '禽芮', gate: '景门', god: '九天' },
  ];

  it('十干克应/门加门/八神/三奇到宫均有命中且键正确', () => {
    const refs = lookupChart({ palaces, hourZhi: '未', hourGan: '癸' });
    const kinds = new Set(refs.map((r) => r.kind));
    expect(kinds.has('十干克应')).toBe(true);
    expect(kinds.has('门加门')).toBe(true);
    expect(kinds.has('八神')).toBe(true);
    expect(kinds.has('九星值时')).toBe(true);
    expect(kinds.has('时加六仪')).toBe(true);

    // 坎1宫 庚+壬 → 十干克应「小格」系断语
    const kan = refs.find((r) => r.kind === '十干克应' && r.gong === 1);
    expect(kan?.key).toBe('庚+壬');
    // 乾6宫 开门加本位开门 → 静应「开门加开」
    const qian = refs.find((r) => r.kind === '门加门' && r.gong === 6);
    expect(qian?.key).toBe('开门加开门');
    // 离9宫 乙奇到离
    const li = refs.find((r) => r.kind === '三奇到宫' && r.gong === 9);
    expect(li?.key).toBe('乙奇到离');
    // 值时：天蓬值未时 应在命中集内
    expect(refs.some((r) => r.kind === '九星值时' && r.key === '天蓬值未时')).toBe(true);
    // 每条都带 docPath 深链
    for (const r of refs) expect(r.docPath).toMatch(/^qmmj\/book\/juan\d+\.md$/);
  });

  it('格局名匹配（引擎格局 ↔ 库内断语）', () => {
    const refs = lookupChart({ palaces: [], patterns: ['青龙返首', '天遁'] });
    expect(refs.some((r) => r.name === '青龙返首')).toBe(true);
    expect(refs.some((r) => r.kind === '格局' && r.name === '天遁')).toBe(true);
  });

  it('标记歌诀命中', () => {
    const refs = lookupChart({ palaces: [], marks: ['门迫', '入墓'] });
    expect(refs.filter((r) => r.kind === '标记')).toHaveLength(2);
  });

  it('去重：同键同宫只出一条', () => {
    const refs = lookupChart({ palaces: [palaces[0], palaces[0]] });
    const ids = refs.map((r) => `${r.kind}|${r.key}|${r.gong}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('多书互证：同格多书断语并出（飞鸟跌穴 ≥3 源），docPath 区分书源', () => {
    expect(keying.geju.length).toBeGreaterThanOrEqual(120);
    const refs = lookupChart({ palaces: [], patterns: ['飞鸟跌穴'] });
    const sources = refs.filter((r) => r.name === '飞鸟跌穴').map((r) => r.docPath);
    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(sources).toContain('qmmj/book/juan15.md');
    expect(sources).toContain('dyyy/book/juan2.md');
    expect(sources).toContain('tz/book/juan01.md');
    // 五不遇时：宝鉴释义也并入
    const wby = lookupChart({ palaces: [], patterns: ['五不遇时格'] }).filter((r) => r.name === '五不遇时格');
    expect(wby.map((r) => r.docPath)).toContain('bj/book/full.md');
  });

  it('底本残注存疑标记：七十二局第31局「蛇入龙穴」（含「俟查」）带 uncertain', () => {
    // 丙奇同太阴临惊门（第31局无星要求，宽松命中）
    const refs = lookupChart({
      palaces: [{ gong: 7, tianPanGan: ['丙'], diPanGan: ['庚'], star: '天柱', gate: '惊门', god: '太阴' }],
    });
    const hit = refs.find((r) => r.name === '蛇入龙穴');
    expect(hit).toBeDefined();
    expect(hit?.uncertain).toBe(true);
    // 无残注的条目不带该标记
    const clean = refs.find((r) => r.kind === '十干克应');
    expect(clean?.uncertain).toBeUndefined();
  });
});

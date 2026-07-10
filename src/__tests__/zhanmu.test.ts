import { describe, expect, it } from 'vitest';
import { getLunDuan, getZhanMu, listTopics, searchZhanMu, zhanmu } from '../zhanmu';

describe('占目库数据完整性', () => {
  it('15 个占类、论断/占目条数达标、无空文', () => {
    expect(listTopics()).toHaveLength(15);
    expect(listTopics()).toContain('求财');
    expect(listTopics()).toContain('婚姻');
    expect(zhanmu.lunDuan.length).toBeGreaterThanOrEqual(200);
    expect(zhanmu.zhanMu.length).toBeGreaterThanOrEqual(100);
    for (const e of [...zhanmu.lunDuan, ...zhanmu.zhanMu]) {
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.docPath).toMatch(/^qmmj\/book\/juan\d+\.md$/);
    }
  });

  it('每个占类都有值符与吉凶格论断', () => {
    for (const topic of listTopics()) {
      const aspects = new Set(getLunDuan(topic).map((e) => e.aspect));
      expect(aspects.has('值符'), `${topic}占缺论值符`).toBe(true);
      expect(aspects.has('吉凶格'), `${topic}占缺论吉凶格`).toBe(true);
    }
  });

  it('getLunDuan 兼容带「占」字写法，家宅保留两套论断', () => {
    expect(getLunDuan('求财占')).toEqual(getLunDuan('求财'));
    const jiaZhaiZhiFu = getLunDuan('家宅').filter((e) => e.aspect === '值符');
    expect(jiaZhaiZhiFu.length).toBeGreaterThanOrEqual(2); // 底本两套，照收
  });

  it('searchZhanMu 关键词命中，getZhanMu 精确取', () => {
    const cai = searchZhanMu(['财', '债']);
    expect(cai.length).toBeGreaterThanOrEqual(4);
    for (const e of cai) expect(/财|债/.test(e.title)).toBe(true);
    expect(getZhanMu('占求财')?.text).toBeTruthy();
    expect(searchZhanMu([])).toEqual([]);
  });
});

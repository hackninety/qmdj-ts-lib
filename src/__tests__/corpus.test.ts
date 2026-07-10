import { describe, expect, it } from 'vitest';
import { getBooks } from '../index';
import { getDocMarkdown, getDocsManifest, getSections, searchDocs } from '../docs';

describe('语料库目录', () => {
  it('45 篇文档，path 前缀限于在册书 slug', () => {
    const manifest = getDocsManifest();
    expect(manifest).toHaveLength(45);
    for (const m of manifest) {
      expect(m.path).toMatch(/^(qmmj|dyyy|tz|bj)\//);
      expect(m.title).toBeTruthy();
      expect(m.book).toBeTruthy();
    }
  });

  it('五部书：秘笈 31 + 金函玉镜 2 + 演義 4 + 統宗 7 + 宝鉴 1，节数合计一致', () => {
    const books = getBooks();
    expect(books).toHaveLength(5);
    const count = (name: string) => books.find((b) => b.book.includes(name));
    expect(count('秘笈大全')?.docCount).toBe(31);
    expect(count('金函玉镜')?.docCount).toBe(2);
    expect(count('遁甲演義')?.docCount).toBe(4);
    expect(count('統宗')?.docCount).toBe(7);
    expect(count('宝鉴')?.docCount).toBe(1);
    expect(books.reduce((s, b) => s + b.sectionCount, 0)).toBe(getSections().length);
  });

  it('节级目录 ≥ 950 节且 order 严格递增', () => {
    const sections = getSections();
    expect(sections.length).toBeGreaterThanOrEqual(950);
    for (let i = 0; i < sections.length; i++) {
      expect(sections[i].order).toBe(i + 1);
      expect(sections[i].title).toBeTruthy();
      expect(sections[i].juan).toBeTruthy();
    }
  });
});

describe('文档读取', () => {
  it('卷一含 H1 与烟波钓叟歌节题', async () => {
    const md = await getDocMarkdown('qmmj/book/juan01.md');
    expect(md).toContain('# 奇门遁甲秘笈大全 卷一');
    expect(md).toContain('## 烟波钓叟歌');
    expect(md).toContain('阴旸顺逆妙难穷');
  });

  it('金函玉镜卷一含专属出处说明', async () => {
    const md = await getDocMarkdown('qmmj/book/jhyj01.md');
    expect(md).toContain('诸葛武侯行兵遁甲金函玉镜 卷一（附）');
    expect(md).toContain('旧题蜀·诸葛亮');
  });

  it('未知 path 返回 undefined', async () => {
    expect(await getDocMarkdown('qmmj/book/nope.md')).toBeUndefined();
    expect(await getDocMarkdown('xxxx/book/juan01.md')).toBeUndefined();
  });

  it('维基文库续册可读：演義卷二（繁体+SKQS 回填）/統宗卷之一/宝鉴释义', async () => {
    const dyyy = await getDocMarkdown('dyyy/book/juan2.md');
    expect(dyyy).toContain('# 遁甲演義 卷二');
    expect(dyyy).toContain('## 飛鳥跌穴');
    const dyyy1 = await getDocMarkdown('dyyy/book/juan1.md');
    expect(dyyy1).toContain('七十二候'); // SKchar 1974 → 候 已回填
    const tz = await getDocMarkdown('tz/book/juan01.md');
    expect(tz).toContain('## 奇门四十格');
    const bj = await getDocMarkdown('bj/book/full.md');
    expect(bj).toContain('## 【释三奇得使】');
  });
});

describe('全文检索', () => {
  it('单关键词命中并携带上下文（多书均可命中）', async () => {
    const hits = await searchDocs('飞鸟跌穴');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.text).toContain('飞鸟跌穴');
      expect(h.docPath).toMatch(/^(qmmj|dyyy|tz|bj)\//);
      expect(h.docTitle).toBeTruthy();
    }
  });

  it('多关键词 AND 语义', async () => {
    const hits = await searchDocs('值符 天乙');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.text).toContain('值符');
      expect(h.text).toContain('天乙');
    }
  });

  it('limit 与 pathPrefix 生效', async () => {
    const limited = await searchDocs('奇门', { limit: 3 });
    expect(limited.length).toBeLessThanOrEqual(3);
    const scoped = await searchDocs('伤门', { pathPrefix: 'qmmj/book/juan05' });
    expect(scoped.length).toBeGreaterThan(0);
    for (const h of scoped) expect(h.docPath).toBe('qmmj/book/juan05.md');
  });

  it('空查询返回空数组', async () => {
    expect(await searchDocs('   ')).toEqual([]);
  });
});

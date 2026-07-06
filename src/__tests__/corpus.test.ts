import { describe, expect, it } from 'vitest';
import { getBooks } from '../index';
import { getDocMarkdown, getDocsManifest, getSections, searchDocs } from '../docs';

describe('语料库目录', () => {
  it('33 篇文档，path 均带 qmmj 前缀', () => {
    const manifest = getDocsManifest();
    expect(manifest).toHaveLength(33);
    for (const m of manifest) {
      expect(m.path.startsWith('qmmj/')).toBe(true);
      expect(m.title).toBeTruthy();
      expect(m.book).toBeTruthy();
    }
  });

  it('两部书：秘笈大全 31 篇 + 金函玉镜 2 篇，节数合计一致', () => {
    const books = getBooks();
    expect(books).toHaveLength(2);
    const main = books.find((b) => b.book === '奇门遁甲秘笈大全');
    const jhyj = books.find((b) => b.book === '金函玉镜（附）');
    expect(main?.docCount).toBe(31);
    expect(jhyj?.docCount).toBe(2);
    expect((main?.sectionCount ?? 0) + (jhyj?.sectionCount ?? 0)).toBe(getSections().length);
  });

  it('节级目录 ≥ 700 节且 order 严格递增', () => {
    const sections = getSections();
    expect(sections.length).toBeGreaterThanOrEqual(700);
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
});

describe('全文检索', () => {
  it('单关键词命中并携带上下文', async () => {
    const hits = await searchDocs('飞鸟跌穴');
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.text).toContain('飞鸟跌穴');
      expect(h.docPath.startsWith('qmmj/')).toBe(true);
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

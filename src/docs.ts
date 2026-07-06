/**
 * 典籍库子入口 —— `import { getDocsManifest, getDocMarkdown, searchDocs } from 'qmdj-ts-lib/docs'`
 *
 * 主包只内联轻量 manifest 与节级目录；各书 markdown 载荷按书分包
 * （src/books/<slug>），`getDocMarkdown` / `searchDocs` 异步按需拉取并缓存。
 * 接口与 lrdq-ts-lib/docs 同形（getDocsManifest / getDocMarkdown），另增全文检索。
 */
import manifestData from './data/docs-manifest.json';
import sectionsData from './data/sections.json';
import type { DocMeta, SearchHit, SearchOptions, SectionMeta } from './types';

export type { DocMeta, SearchHit, SearchOptions, SectionMeta } from './types';

const manifest = (manifestData as unknown as { manifest: DocMeta[] }).manifest;
const sections = (sectionsData as unknown as { sections: SectionMeta[] }).sections;

/** 各书载荷加载器（新书登记于此，与 gen-data CORPUS 对应） */
const LOADERS: Record<string, () => Promise<{ payload: { docs: Record<string, string> } }>> = {
  qmmj: () => import('./books/qmmj'),
};

const cache = new Map<string, Record<string, string>>();

async function loadBook(slug: string): Promise<Record<string, string> | undefined> {
  let docs = cache.get(slug);
  if (!docs) {
    const loader = LOADERS[slug];
    if (!loader) return undefined;
    docs = (await loader()).payload.docs;
    cache.set(slug, docs);
  }
  return docs;
}

/** 典籍文档目录（全库篇目，含 book/dynasty；轻量，同步） */
export function getDocsManifest(): DocMeta[] {
  return manifest;
}

/** 节级目录（全库小节索引；轻量，同步） */
export function getSections(): SectionMeta[] {
  return sections;
}

/** 取某篇文档 markdown（异步：按 path 的书 slug 路由，首次拉取该书载荷并缓存） */
export async function getDocMarkdown(path: string): Promise<string | undefined> {
  const docs = await loadBook(path.split('/')[0]);
  return docs?.[path];
}

/**
 * 全文检索（异步：按需加载载荷）。
 * query 支持空格分隔多关键词（AND 语义，段落内共现即命中）。
 */
export async function searchDocs(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const limit = opts.limit ?? 50;
  const hits: SearchHit[] = [];

  for (const meta of manifest) {
    if (opts.pathPrefix && !meta.path.startsWith(opts.pathPrefix)) continue;
    const md = await getDocMarkdown(meta.path);
    if (!md) continue;
    let section: string | undefined;
    const paras = md.split('\n');
    for (let i = 0; i < paras.length; i++) {
      const line = paras[i];
      if (!line) continue;
      const h = line.match(/^##\s+(.+)$/);
      if (h) {
        section = h[1].trim();
        continue;
      }
      if (line.startsWith('#') || line.startsWith('>')) continue;
      if (terms.every((t) => line.includes(t))) {
        hits.push({ docPath: meta.path, docTitle: meta.title, section, text: line, index: i });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

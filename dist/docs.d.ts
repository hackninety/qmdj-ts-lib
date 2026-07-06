import type { DocMeta, SearchHit, SearchOptions, SectionMeta } from './types';
export type { DocMeta, SearchHit, SearchOptions, SectionMeta } from './types';
/** 典籍文档目录（全库篇目，含 book/dynasty；轻量，同步） */
export declare function getDocsManifest(): DocMeta[];
/** 节级目录（全库小节索引；轻量，同步） */
export declare function getSections(): SectionMeta[];
/** 取某篇文档 markdown（异步：按 path 的书 slug 路由，首次拉取该书载荷并缓存） */
export declare function getDocMarkdown(path: string): Promise<string | undefined>;
/**
 * 全文检索（异步：按需加载载荷）。
 * query 支持空格分隔多关键词（AND 语义，段落内共现即命中）。
 */
export declare function searchDocs(query: string, opts?: SearchOptions): Promise<SearchHit[]>;

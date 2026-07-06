import type { BookInfo } from './types';
export * from './types';
/** 语料册清单（轻量元信息；正文走 `qmdj-ts-lib/docs`）。同一 slug 载荷可含正册与附录册，按书名分组 */
export declare function getBooks(): BookInfo[];

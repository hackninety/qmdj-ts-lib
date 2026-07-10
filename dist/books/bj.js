/**
 * 《奇门宝鉴（御定）》文档载荷 —— 仅供 docs.ts 动态导入（按书分包）。
 * 宿主勿直接引入本模块；走 `qmdj-ts-lib/docs` 的 getDocMarkdown 路由。
 */
import data from '../data/docs-bj.json' with { type: 'json' };
export const payload = data;

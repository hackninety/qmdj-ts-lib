/**
 * qmdj-ts-lib 领域模型
 *
 * 语料：《奇門遁甲秘笈大全》（旧题明·刘伯温辑，ctext.org wiki res=953105 转录）
 *       附《諸葛武侯行兵遁甲金函玉鏡》残卷（卷一、卷六）
 */
/** 典籍文档元信息（多书语料库：path 带书 slug 前缀，book 标识典籍名） */
export interface DocMeta {
    /** `<slug>/<group>/<file>.md`（如 qmmj/book/juan01.md） */
    path: string;
    title: string;
    /** book=原文；后续深度分支（如 algorithm）另立 group */
    group: string;
    /** 典籍名（宿主抽屉分组依据） */
    book: string;
    dynasty?: string;
    author?: string;
}
/** 节级目录条目（深度结构化：全库小节索引，供目录树与深链） */
export interface SectionMeta {
    /** 所属文档 path（qmmj/book/juan01.md） */
    docPath: string;
    /** 卷题（如「卷一」「金函玉鏡卷一」） */
    juan: string;
    /** 节题原文 */
    title: string;
    /** 节在全库中的序号（1 起） */
    order: number;
}
/** 全文检索命中 */
export interface SearchHit {
    docPath: string;
    docTitle: string;
    /** 命中行所在小节题（无节题时为空） */
    section?: string;
    /** 命中段落原文 */
    text: string;
    /** 段落在该文档中的序号（0 起，含标题行） */
    index: number;
}
export interface SearchOptions {
    /** 最多返回条数（默认 50） */
    limit?: number;
    /** 限定文档 path 前缀（如 'qmmj/book/juan01'） */
    pathPrefix?: string;
}
/** 语料册元信息 */
export interface BookInfo {
    slug: string;
    book: string;
    dynasty?: string;
    author?: string;
    /** 底本与转录来源说明 */
    source: string;
    /** 文档篇数 */
    docCount: number;
    /** 小节总数 */
    sectionCount: number;
}

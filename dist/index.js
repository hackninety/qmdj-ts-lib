/**
 * qmdj-ts-lib —— 奇门遁甲典籍语料库
 *
 * 首册：《奇門遁甲秘笈大全》三十卷（旧题明·刘伯温辑，ctext.org wiki res=953105
 * 转录），附《諸葛武侯行兵遁甲金函玉鏡》残卷（卷一、卷六）。
 *
 * 典籍内容走子入口 `qmdj-ts-lib/docs`（getDocsManifest / getSections /
 * getDocMarkdown / searchDocs）——全书文本按书分包懒加载，宿主主包不背整部书卷。
 * 主入口只提供轻量书目元信息与类型。
 */
import manifestData from './data/docs-manifest.json' with { type: 'json' };
import sectionsData from './data/sections.json' with { type: 'json' };
export * from './types.js';
const manifest = manifestData.manifest;
const sections = sectionsData.sections;
/** 语料册清单（轻量元信息；正文走 `qmdj-ts-lib/docs`）。同一 slug 载荷可含正册与附录册，按书名分组 */
export function getBooks() {
    const byBook = new Map();
    const bookOfPath = new Map();
    for (const m of manifest) {
        bookOfPath.set(m.path, m.book);
        let info = byBook.get(m.book);
        if (!info) {
            info = {
                slug: m.path.split('/')[0],
                book: m.book,
                dynasty: m.dynasty,
                author: m.author,
                source: 'ctext.org wiki res=953105 转录',
                docCount: 0,
                sectionCount: 0,
            };
            byBook.set(m.book, info);
        }
        info.docCount++;
    }
    for (const s of sections) {
        const book = bookOfPath.get(s.docPath);
        const info = book ? byBook.get(book) : undefined;
        if (info)
            info.sectionCount++;
    }
    return [...byBook.values()];
}

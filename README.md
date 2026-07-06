# qmdj-ts-lib 奇门遁甲典籍语料库

奇门遁甲古籍的 TypeScript 语料库。首册收录**《奇門遁甲秘笈大全》三十卷**（旧题明·刘伯温辑），
附**《諸葛武侯行兵遁甲金函玉鏡》残卷**（卷一、卷六，旧题蜀·诸葛亮撰）。

- 底本：[ctext.org wiki res=953105](https://ctext.org/wiki.pl?if=gb&res=953105&remap=gb) 简体转录本
- 规模：33 篇文档 · **796 个结构化小节**（烟波钓叟歌、八门/九星克应、百余占目、七十二局、九遁、符箓、金锁玉环数占……）
- 口径：转录内容**不改字**；节题经全量短行聚类核对后标注，版面碎片/落款照录为段落（见 `scripts/gen-data.mjs` DENY 清单）

## 安装与使用

```bash
npm install github:hackninety/qmdj-ts-lib   # 或本地开发 file:../qmdj-ts-lib
```

```ts
// 主入口：轻量书目元信息
import { getBooks } from 'qmdj-ts-lib';
getBooks(); // [{ book:'奇门遁甲秘笈大全', docCount:31, sectionCount:750 }, { book:'金函玉镜（附）', … }]

// 典籍子入口：目录 / 节级索引 / 正文 / 全文检索（载荷按书分包懒加载）
import { getDocsManifest, getSections, getDocMarkdown, searchDocs } from 'qmdj-ts-lib/docs';

getDocsManifest();                          // 33 篇目录（title/book/dynasty/author）
getSections();                              // 796 节索引（docPath/juan/title/order）
await getDocMarkdown('qmmj/book/juan01.md'); // 卷一 markdown（含「烟波钓叟歌」等 15 节）
await searchDocs('飞鸟跌穴');                 // 全文检索（空格分隔多词 AND）
await searchDocs('伤门', { pathPrefix: 'qmmj/book/juan05', limit: 20 });
```

## 数据流水线

```
docs/corpus/qmmj/raw/*.html   ← scripts/fetch-ctext.mjs（ctext 礼貌抓取，断点续抓）
docs/corpus/qmmj/text/*.txt   ← scripts/extract-ctext.mjs（剥标签解实体，不改字）
src/data/*.json + docs/structured/qmmj/*.md ← scripts/gen-data.mjs（深度结构化）
dist/                         ← scripts/build.mjs（tsc + ESM 导入修正）
```

## 目录概要

| 范围 | 内容 |
|---|---|
| 序 | 总序（洪武四年刘基识） |
| 卷一~卷四 | 烟波钓叟歌、起例、十干克应、九星、三奇/八门克应 |
| 卷五~卷六 | 八门克应（续）、五假三诈、九遁、超神接气 |
| 卷七~卷十 | 奇门主客、百余占目（占投军…占立窑） |
| 卷十一~卷二十 | 千金诀、兵占、分类论断（值符/值使/十干/九星/九宫/门户/三甲） |
| 卷二十一~卷二十八 | 星宿过度、天符经、克应验、值时克应（九星×十二时）、出行诀、符咒 |
| 卷二十九 | 阴阳遁七十二局立成图 |
| 卷三十 | 奇门地盘图等（底本转录不全） |
| 附 | 金函玉镜卷一（起例/飞宫）、卷六（金锁玉环数占） |

## 版权

代码 MIT；底本为公版古籍，转录来源 ctext.org（研习用途，注明出处）。

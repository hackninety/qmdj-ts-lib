# react-qimen 接入指南 —— 典籍语料库并册

## 1. 安装

```bash
npm install file:../qmdj-ts-lib          # 本地开发
# 发布 GitHub 后：npm install github:hackninety/qmdj-ts-lib#v0.1.0
```

## 2. 典籍抽屉

manifest 携 `book/dynasty/author`（分组身份在数据层），`getDocMarkdown` 为**异步**
（载荷按书分包，首次访问才拉取 chunk，宿主主包不背整部书卷）：

```ts
import { getDocsManifest, getSections, getDocMarkdown, searchDocs } from 'qmdj-ts-lib/docs';

// 抽屉目录：按 book 分组
const groups = Map.groupBy(getDocsManifest(), (m) => m.book);

// 打开某篇：
const md = await getDocMarkdown(meta.path);

// 全文检索（多词 AND；限定卷用 pathPrefix）：
const hits = await searchDocs('青龙返首');
```

## 3. 与排盘联动（可选）

节级目录 `getSections()` 含 796 节题（如「占求财」「天蓬星值子时」「第一局」），
可按当前盘面要素反查典籍：

```ts
import { getSections } from 'qmdj-ts-lib/docs';

// 例：值符星为天蓬、时辰为子时 → 深链「天蓬星值子时」节
const sec = getSections().find((s) => s.title === `${star}星值${hourZhi}时`);
// 例：阳遁N局 → 卷二十九「第N局」立成图
```

## 4. 注意

- 转录为**简体**底本，检索词用简体（如「飞鸟跌穴」）；同一术语底本写法可能不一（如「青龙返首/青龙反首」均有），检索时留意
- `qmmj/book/juan30.md` 底本转录不全（仅 2 节），属上游现状

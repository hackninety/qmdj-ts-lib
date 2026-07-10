/**
 * 占目库子入口 —— `import { getLunDuan, searchZhanMu } from 'qmdj-ts-lib/zhanmu'`
 *
 * 「所占何事 → 断法原文」：
 * - 分类论断（卷十一~十四）：15 占类 × 论干支/值符/值使/十干/九星/九宫/门户/三甲/吉凶格
 * - 具体占目（卷七~十）：110 条一题一法（占求财/占婚姻/占词讼…）
 * 宿主按占类取古法喂 AI，与盘面克应库（./keying）互补：一个给「方法」，一个给「断语」。
 */
import zhanmuData from './data/zhanmu.json' with { type: 'json' };
/** 占目库全量数据 */
export const zhanmu = zhanmuData;
/** 全部占类（不带「占」字），按典籍出现序 */
export function listTopics() {
    return zhanmu.topics;
}
/** 某占类的分类论断（传「求财」或「求财占」均可；保持典籍原序，含重复方面如家宅两套） */
export function getLunDuan(topic) {
    const t = topic.replace(/占$/, '');
    return zhanmu.lunDuan.filter((e) => e.topic === t);
}
/** 按关键词检索具体占目（题名含任一关键词即命中） */
export function searchZhanMu(keywords) {
    const ks = keywords.filter(Boolean);
    if (!ks.length)
        return [];
    return zhanmu.zhanMu.filter((e) => ks.some((k) => e.title.includes(k)));
}
/** 按题名精确取占目 */
export function getZhanMu(title) {
    return zhanmu.zhanMu.find((e) => e.title === title);
}

export interface LunDuanEntry {
    /** 占类（不带「占」字：求财/婚姻/疾病…） */
    topic: string;
    /** 论断方面（值符/值使/十干/九星/九宫/门户/三甲/吉凶格/干支/综断/诀） */
    aspect: string;
    /** 节题原文（论值符/又论吉凶格…） */
    title: string;
    text: string;
    docPath: string;
}
export interface ZhanMuEntry {
    /** 占目题名原文（占求财/占词讼吉凶/开挖水道…） */
    title: string;
    text: string;
    docPath: string;
}
interface ZhanmuData {
    source: string;
    topics: string[];
    lunDuan: LunDuanEntry[];
    zhanMu: ZhanMuEntry[];
}
/** 占目库全量数据 */
export declare const zhanmu: ZhanmuData;
/** 全部占类（不带「占」字），按典籍出现序 */
export declare function listTopics(): string[];
/** 某占类的分类论断（传「求财」或「求财占」均可；保持典籍原序，含重复方面如家宅两套） */
export declare function getLunDuan(topic: string): LunDuanEntry[];
/** 按关键词检索具体占目（题名含任一关键词即命中） */
export declare function searchZhanMu(keywords: string[]): ZhanMuEntry[];
/** 按题名精确取占目 */
export declare function getZhanMu(title: string): ZhanMuEntry | undefined;
export {};

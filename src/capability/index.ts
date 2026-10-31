// 能力层的调用契约（**只放契约，不放实现** —— 矩阵规划 03 §4.2）。
//
// 每个文件对应 z-biz-tool-capability 下的一个 crate：
//   types.ts    cap-img（历史文件，保持路径不变）
//   cap-audio.ts / cap-video.ts / cap-doc.ts / cap-llm.ts /
//   cap-hub.ts / cap-meeting.ts / cap-hash.ts / cap-sso.ts
//
// 契约漂移是这类分层里最难发现的一类 bug：Rust 改名、前端还按老名字调，
// 两边都不编译报错 —— 前端拿到的是运行时报错，或静默走错分支。
// `tests/capability-contract.test.ts` 是「声明 ↔ 注册」那个检查项。

export * from './types';
export * from './cap-audio';
export * from './cap-video';
export * from './cap-doc';
export * from './cap-llm';
export * from './cap-meeting';
export * from './cap-hub';
export * from './cap-hash';
export * from './cap-sso';

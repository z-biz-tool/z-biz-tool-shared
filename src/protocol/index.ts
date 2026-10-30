// zBiz 跨产品通信契约。
//
// 规范来源：z-biz-tool-lead/doc/矩阵规划/04_连接度：家族面板与统一协议.md §3。
//
// 三个文件：
//   deeplink.ts        —— zbiz:// 深链的解析与构造（字节级金标 = box 的 handoff.rs）
//   deeplinkReceiver.ts—— 深链「收侧」通用件（冷启动补取 + 事件监听 + 不静默吞掉）
//   familyEvents.ts    —— 家族级事件定义（跨进程广播用）
//
// 产品元数据在 ../types/product.ts —— 因为它是「会过期的数据」，
// 该有主人，而不是和协议格式混在一起。
export * from './deeplink';
export * from './deeplinkReceiver';
export * from './familyEvents';

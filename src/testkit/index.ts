// 契约测试的公共件。
//
// 给各仓的「前端 invoke ⇄ Rust #[tauri::command]」门禁用，
// 让它们在**共享层化之后**仍然有效 —— 详见 ipcContract.ts 的说明。
export * from './ipcContract';

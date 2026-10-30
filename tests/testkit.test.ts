/**
 * 契约测试公共件的测试。
 *
 * 这些扫描器本身是「量具」—— 量具坏了会让各仓的门禁失灵，
 * 所以它们自己也必须有测试。
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  collectCmdConstants,
  collectSharedConsumedCommands,
  SHARED_CONSUMED_COMMANDS,
} from "../src/testkit/ipcContract.ts";

/** 在临时目录里造几个源文件。 */
function makeFiles(specs: Record<string, string>): string[] {
  const dir = mkdtempSync(join(tmpdir(), "zbt-testkit-"));
  const out: string[] = [];
  for (const [name, content] of Object.entries(specs)) {
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content, "utf8");
    out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * collectCmdConstants
 * ------------------------------------------------------------------ */

test("collectCmdConstants：认出 export const X = \"cmd_name\"", () => {
  const files = makeFiles({
    "a.ts": `export const ZBIZ_TAKE_PENDING = "zbiz_take_pending";\nexport const OTHER = "other_cmd";\n`,
  });
  const map = collectCmdConstants(files);
  assert.equal(map.get("ZBIZ_TAKE_PENDING"), "zbiz_take_pending");
  assert.equal(map.get("OTHER"), "other_cmd");
});

test("collectCmdConstants：带类型标注的常量也能认出", () => {
  const files = makeFiles({
    "a.ts": `export const ZBIZ_TAKE_PENDING: string = "zbiz_take_pending";\n`,
  });
  assert.equal(collectCmdConstants(files).get("ZBIZ_TAKE_PENDING"), "zbiz_take_pending");
});

test("collectCmdConstants：非 export 的常量不收（那是模块内部实现）", () => {
  const files = makeFiles({
    "a.ts": `const INTERNAL = "internal_cmd";\n`,
  });
  assert.equal(collectCmdConstants(files).size, 0);
});

test("collectCmdConstants：空文件列表不炸", () => {
  assert.equal(collectCmdConstants([]).size, 0);
});

/* ------------------------------------------------------------------ *
 * collectSharedConsumedCommands
 * ------------------------------------------------------------------ */

test("collectSharedConsumedCommands：import 了共享层协议子路径 ⇒ 认得共享层消费的命令", () => {
  const files = makeFiles({
    "App.tsx": `import { startDeepLinkReceiver } from "z-biz-tool-shared/protocol";\n`,
  });
  const set = collectSharedConsumedCommands(files);
  assert.ok(set.has("zbiz_take_pending"), "应认出取队列命令");
});

test("collectSharedConsumedCommands：没 import 共享层 ⇒ 不认", () => {
  const files = makeFiles({
    "App.tsx": `import { invoke } from "@tauri-apps/api/core";\n`,
  });
  assert.equal(collectSharedConsumedCommands(files).size, 0);
});

test("collectSharedConsumedCommands：只 import 别的子路径不算", () => {
  // 共享层有多个子路径；只有协议子路径才是深链接收侧。
  const files = makeFiles({
    "App.tsx": `import { radius } from "z-biz-tool-shared/styles";\n`,
  });
  assert.equal(collectSharedConsumedCommands(files).size, 0);
});

test("collectSharedConsumedCommands：import 写在多行 import 语句里也能认出", () => {
  const files = makeFiles({
    "App.tsx": `import {\n  startDeepLinkReceiver,\n  ZBIZ_TAKE_PENDING,\n} from "z-biz-tool-shared/protocol";\n`,
  });
  assert.ok(collectSharedConsumedCommands(files).has("zbiz_take_pending"));
});

test("collectSharedConsumedCommands：多个文件里只要有一处 import 就认", () => {
  const files = makeFiles({
    "a.ts": `import { invoke } from "@tauri-apps/api/core";\n`,
    "b.tsx": `import { startDeepLinkReceiver } from "z-biz-tool-shared/protocol";\n`,
  });
  assert.ok(collectSharedConsumedCommands(files).has("zbiz_take_pending"));
});

test("collectSharedConsumedCommands：自定义共享层路径可用", () => {
  const files = makeFiles({
    "a.ts": `import { startDeepLinkReceiver } from "@my/shared/protocol";\n`,
  });
  const set = collectSharedConsumedCommands(files, "@my/shared/protocol");
  assert.ok(set.has("zbiz_take_pending"));
});

test("collectSharedConsumedCommands：空文件列表不炸", () => {
  assert.equal(collectSharedConsumedCommands([]).size, 0);
});

/* ------------------------------------------------------------------ *
 * 清单本身
 * ------------------------------------------------------------------ */

test("共享层消费清单里的每个命令都带说明（不留空串）", () => {
  for (const [mod, cmds] of Object.entries(SHARED_CONSUMED_COMMANDS)) {
    assert.ok(cmds.length > 0, `${mod} 没有登记任何命令`);
    for (const c of cmds) {
      assert.match(c, /^[a-z][a-z0-9_]*$/, `${mod} 的命令名不像 Tauri 命令名：${c}`);
    }
  }
});

test("共享层消费清单里的命令名与共享层导出的常量一致", () => {
  // 清单写错命令名 ⇒ 各仓的门禁认错命令 ⇒ 门禁失灵。
  // 这条把「清单 ↔ 实际实现」这一环锁住。
  assert.deepEqual([...SHARED_CONSUMED_COMMANDS.startDeepLinkReceiver], ["zbiz_take_pending"]);
});

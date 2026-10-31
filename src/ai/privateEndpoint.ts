/**
 * 「这份配置指向本机 / 局域网吗」—— 前端侧的免密钥判定。
 *
 * ## 为什么前端也要有这份判据
 *
 * 后端 cap-llm 的 `LlmConfig::needs_api_key()` 已经统一了免密钥判定：
 * ① 选了登记「免 Key」的预设；② 地址落在本机 / 局域网。
 * 但前端也得判同一件事 —— 否则会出现**判据分裂**：
 * 后端放行、前端却说「还没配置 API Key」，用户点一下就被弹回设置页，
 * 而设置页里后端根本不要求填 Key（填了也无处可用）。
 *
 * 分裂的两副面孔：
 * - AI 对话框的「密钥框该藏不该藏」—— 藏错了用户找不到该填的地方；
 * - AI 功能入口的「已配置没有」—— 判错了功能按钮直接禁用，用户无从知道原因。
 *
 * ## 为什么规则必须与 Rust 侧逐条对齐
 *
 * Rust 的 `is_private_endpoint()` 在 `z-biz-tool-capability/crates/cap-llm/src/config.rs`。
 * 这份实现是它的**逐条镜像**，两边认同一批地址：
 *
 * - 回环：`localhost` / `127.0.0.0/8` / `::1` / `0.0.0.0`
 * - 私有段：`10/8`、`172.16/12`、`192.168/16`
 * - 本地域名：`.local`（mDNS）、`.lan`、`.internal`、`host.docker.internal`
 *
 * 只看 host，**不看端口**：llama.cpp 8200、Ollama 11434、LM Studio 1234、
 * vLLM 8000，按端口列举必然过时；而 host 属于私有段的判断依据是
 * IPv4/IPv6 保留地址（RFC 1918 / RFC 4193），不会随时间失效。
 *
 * ## 改这份代码之前
 *
 * 先确认 Rust 侧没变。判据分裂的根因永远是「两份实现漂移」，
 * 而 Rust 侧是金标（它决定请求实际发不发鉴权头）。
 */

/**
 * 从 URL 里取 host（去掉 scheme、userinfo、端口、路径）。
 *
 * 不引 `url` 包：这里的输入只有 baseUrl 一种，且历史配置里存在
 * `192.168.1.2:8200/v1`（无 scheme）这种写法，严格解析器反而要额外容错。
 * 取不到就返回空串，由调用方当作「不是私有地址」处理。
 */
export function hostOf(url: string): string {
  const rest = url.includes('://') ? url.slice(url.indexOf('://') + 3) : url;
  const hostPort = rest.split('/')[0] ?? '';
  // userinfo@host
  const afterUser = hostPort.includes('@')
    ? hostPort.slice(hostPort.lastIndexOf('@') + 1)
    : hostPort;
  // IPv6 字面量 [::1]:8200
  if (afterUser.startsWith('[')) {
    const end = afterUser.indexOf(']');
    return end === -1 ? afterUser : afterUser.slice(0, end + 1);
  }
  return afterUser.split(':')[0] ?? '';
}

/** IPv4 是否落在回环 / 私有段 / link-local / 未指定地址里。 */
function isPrivateV4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => {
    // 只接受纯数字段 —— "1e2" 这类不是合法 IPv4 写法
    if (!/^\d{1,3}$/.test(p)) return -1;
    const n = Number(p);
    return n >= 0 && n <= 255 ? n : -1;
  });
  if (nums.some((n) => n < 0)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 127) return true; // 127.0.0.0/8 回环
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 0) return true; // 0.0.0.0 未指定
  return false;
}

/** IPv6 是否是回环或唯一本地地址（fc00::/7）。 */
function isPrivateV6(host: string): boolean {
  const inner = host.replace(/^\[|\]$/g, '');
  if (!inner.includes(':')) return false;
  const lower = inner.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  // fc00::/7 —— 唯一本地地址（ULA）。段首的高两位判据：fc/fd 开头。
  const head = lower.split(':')[0] ?? '';
  if (!/^[0-9a-f]{1,4}$/.test(head)) return false;
  const n = parseInt(head, 16);
  return (n & 0xfe00) === 0xfc00;
}

/**
 * 该地址是否指向「本机 / 局域网」。
 *
 * 与 Rust 侧 `cap_llm::is_private_endpoint()` 逐条对齐。
 */
export function isPrivateEndpoint(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();

  // 名称类：mDNS / 局域网后缀 / 容器回流名。这些后缀不可能属于公网服务，
  // 但它们解析不成 IP，必须显式列出，否则 `.local` 的 mini 会被当成公网。
  if (
    h === 'localhost' ||
    h === 'host.docker.internal' ||
    h.endsWith('.local') ||
    h.endsWith('.lan') ||
    h.endsWith('.internal')
  ) {
    return true;
  }

  if (h.includes(':')) return isPrivateV6(host);
  return isPrivateV4(h);
}

/**
 * 这份 AI 配置要不要 API Key。
 *
 * 与 Rust 侧 `LlmConfig::needs_api_key()` **判据顺序严格一致**：
 *
 * ① 预设登记为「免 Key」→ 免（显式声明，优先）；
 * ② 预设登记为「要 Key」→ **要**（哪怕地址被改成本机代理，也按预设走 ——
 *    用户显式选的厂商优先于地址猜测。这条反向约束是 Rust 侧
 *    `private_endpoint_does_not_rescue_key_requiring_preset` 钉死的）；
 * ③ 没匹配到预设（自定义服务）→ 看地址：私网免、公网要。
 *
 * 第②条最容易被写反：只判「预设说不免」而不判「预设说要」，
 * 会让「选了 DeepSeek 但把地址指向本机代理」的场景被私网规则救掉，
 * 于是请求发出去了、没带鉴权头、拿到 401 —— 而用户完全不知道为什么。
 *
 * @param presetRequiresApiKey 预设施置里的 `requires_api_key`；
 *   传 `undefined` 表示「没匹配到预设」（自定义服务）。
 * @param baseUrl 服务地址。
 */
export function needsApiKey(
  presetRequiresApiKey: boolean | undefined,
  baseUrl: string,
): boolean {
  if (presetRequiresApiKey === false) return false;
  if (presetRequiresApiKey === true) return true;
  return !isPrivateEndpoint(baseUrl);
}

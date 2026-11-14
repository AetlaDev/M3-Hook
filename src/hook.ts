import { m3HookOnCleanup } from './lifecycle';

export interface M3HookVM {
  runtime?: unknown;
  addSprite?: (data: ArrayBuffer) => unknown;
}

type M3HookRuntime = { targets?: unknown };

type M3HookPage = Window &
  typeof globalThis & {
    __m3hookEditorVM?: unknown;
    vm?: unknown;
  };

type M3HookBind = (self: unknown, ...args: unknown[]) => unknown;

const m3HookPage: M3HookPage = (
  typeof unsafeWindow === 'object' && unsafeWindow ? unsafeWindow : window
) as M3HookPage;

function m3HookPatchBind(target: Window & typeof globalThis): void {
  const page = target as Window &
    typeof globalThis & {
      vm?: unknown;
      __m3hookEditorVM?: unknown;
      __m3hookBindPatched?: boolean;
    };
  const proto = page.Function && page.Function.prototype;
  if (!proto) return;
  const holder = proto as unknown as {
    __m3hookBindPatched?: boolean;
    bind: M3HookBind;
  };
  if (holder.__m3hookBindPatched) return;

  const originalBind = holder.bind;
  holder.__m3hookBindPatched = true;
  holder.bind = function (this: unknown, ctx: unknown, ...args: unknown[]): unknown {
    if (ctx && typeof ctx === 'object') {
      const vm = ctx as { editingTarget?: unknown; runtime?: M3HookRuntime | null };
      const isVM =
        Object.prototype.hasOwnProperty.call(vm, 'editingTarget') &&
        Object.prototype.hasOwnProperty.call(vm, 'runtime') &&
        Boolean(vm.runtime) &&
        typeof vm.runtime === 'object' &&
        (vm.runtime as M3HookRuntime).targets !== undefined;
      if (isVM) {
        holder.bind = originalBind;
        holder.__m3hookBindPatched = false;
        page.vm = vm;
        page.__m3hookEditorVM = vm;
      }
    }
    return (originalBind as Function).call(this, ctx, ...args);
  };
}

function m3HookPatchScratch(target: Window & typeof globalThis): void {
  const page = target as Window &
    typeof globalThis & {
      Scratch?: { vm?: unknown };
      vm?: unknown;
      __m3hookEditorVM?: unknown;
      __m3hookScratchPatched?: boolean;
    };
  if (page.__m3hookScratchPatched) return;
  page.__m3hookScratchPatched = true;

  const capture = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const vm = value as { runtime?: Record<string, unknown> | null };
    const runtime = vm.runtime;
    if (!runtime || typeof runtime !== 'object' || runtime.targets === undefined) return;
    const existing = page.__m3hookEditorVM as { runtime?: unknown } | undefined;
    if (existing && existing.runtime) return;
    page.__m3hookEditorVM = value;
    page.vm = value;
  };

  const trap = (holder: unknown): void => {
    if (!holder || typeof holder !== 'object') return;
    try {
      const object = holder as { vm?: unknown };
      let current = object.vm;
      capture(current);
      Object.defineProperty(object, 'vm', {
        configurable: true,
        enumerable: true,
        get: () => current,
        set: (value: unknown) => {
          current = value;
          capture(value);
        },
      });
    } catch {}
  };

  let store: unknown;
  try {
    Object.defineProperty(page, 'Scratch', {
      configurable: true,
      enumerable: true,
      get: () => store,
      set: (value: unknown) => {
        store = value;
        trap(value);
      },
    });
  } catch {}
  trap(page.Scratch);
}

function m3HookPatchHostBridge(target: Window & typeof globalThis): void {
  const page = target as Window &
    typeof globalThis & {
      GandiEditorHost?: unknown;
      __m3hookTestPayload?: unknown;
      __m3hookHostTrap?: boolean;
    };

  const wrap = (container: unknown): void => {
    if (!container || (typeof container !== 'object' && typeof container !== 'function')) return;
    const object = container as Record<string, unknown>;
    const original = object.getUserInfo;
    if (typeof original !== 'function') return;
    if ((original as { __m3hookTest?: boolean }).__m3hookTest) return;

    const wrapper = function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const payload = page.__m3hookTestPayload as Record<string, unknown> | null | undefined;
      let result: Promise<unknown>;
      try {
        result = Promise.resolve((original as Function).apply(this, args));
      } catch {
        return Promise.resolve(payload ?? null);
      }
      if (!payload) return result;
      return result.then(
        (info) => {
          if (!info || typeof info !== 'object') return payload;
          return Object.assign({}, info as Record<string, unknown>, payload);
        },
        () => payload,
      );
    } as ((...args: unknown[]) => Promise<unknown>) & { __m3hookTest?: boolean };
    wrapper.__m3hookTest = true;
    try {
      object.getUserInfo = wrapper;
    } catch {
      return;
    }
    if (object.getUserInfo !== wrapper) {
      try {
        Object.defineProperty(object, 'getUserInfo', { configurable: true, value: wrapper });
      } catch {}
    }
  };

  const trapHost = (host: unknown): void => {
    if (!host || typeof host !== 'object') return;
    const object = host as Record<string, unknown>;
    wrap(object.extensionApi);
    wrap(object.ccwAPI);
    wrap(object.api);
    wrap(host);
  };

  if (page.__m3hookHostTrap) {
    trapHost(page.GandiEditorHost);
    return;
  }
  page.__m3hookHostTrap = true;
  let store = page.GandiEditorHost;
  try {
    Object.defineProperty(page, 'GandiEditorHost', {
      configurable: true,
      enumerable: true,
      get: () => store,
      set: (value: unknown) => {
        store = value;
        trapHost(value);
      },
    });
  } catch {}
  trapHost(store);
}

function m3HookAllWindows(): Window[] {
  const list: Window[] = [];
  const push = (value: unknown): void => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return;
    const win = value as Window;
    if (!list.includes(win)) list.push(win);
  };
  push(m3HookPage);
  push(window);
  try {
    const frames = m3HookPage.frames;
    for (let index = 0; index < frames.length; index += 1) push(frames[index]);
  } catch {}
  return list;
}

function m3HookPublishPayload(): void {
  const payload = m3HookPlayerPayload();
  for (const win of m3HookAllWindows()) {
    try {
      (win as Window & { __m3hookTestPayload?: unknown }).__m3hookTestPayload = payload;
    } catch {}
    try {
      m3HookPatchHostBridge(win as Window & typeof globalThis);
    } catch {}
  }
  m3HookHostPatched = m3HookHostMarked();
}

function m3HookHostMarked(): boolean {
  for (const win of m3HookAllWindows()) {
    let host: unknown;
    try {
      host = (win as Window & { GandiEditorHost?: unknown }).GandiEditorHost;
    } catch {
      continue;
    }
    if (!host || typeof host !== 'object') continue;
    const object = host as Record<string, unknown>;
    const containers = [object.extensionApi, object.ccwAPI, object.api, host];
    for (const container of containers) {
      if (!container || typeof container !== 'object') continue;
      const getter = (container as Record<string, unknown>).getUserInfo;
      if (getter && (getter as { __m3hookTest?: boolean }).__m3hookTest) return true;
    }
  }
  return false;
}

function m3HookInstallMainWorldHook(): void {
  const script = document.createElement('script');
  script.textContent = `(${m3HookPatchBind.toString()})(window);(${m3HookPatchScratch.toString()})(window);(${m3HookPatchHostBridge.toString()})(window);`;
  const append = (): void => {
    (document.head || document.documentElement || document).appendChild(script);
    script.remove();
  };
  if (document.head || document.documentElement) {
    append();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    append();
    observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

m3HookPatchBind(m3HookPage as Window & typeof globalThis);
m3HookPatchScratch(m3HookPage as Window & typeof globalThis);
m3HookPatchHostBridge(m3HookPage as Window & typeof globalThis);
m3HookInstallMainWorldHook();

let m3HookEditorVM: M3HookVM | null = null;
const m3HookVMListeners = new Set<(vm: M3HookVM) => void>();

function m3HookIsVM(value: unknown): value is M3HookVM {
  if (!value || typeof value !== 'object') return false;
  const runtime = (value as { runtime?: M3HookRuntime | null }).runtime;
  return Boolean(runtime) && typeof runtime === 'object' && runtime.targets !== undefined;
}

function m3HookIsReadyVM(vm: M3HookVM): boolean {
  const runtime = vm.runtime as { targets?: unknown } | null;
  const targets = runtime && runtime.targets;
  if (Array.isArray(targets) && targets.length > 0) return true;
  const editing = vm as { editingTarget?: { sprite?: unknown } | null };
  return Boolean(editing.editingTarget && editing.editingTarget.sprite);
}

function m3HookScratchCandidates(win: unknown): unknown[] {
  const list: unknown[] = [];
  try {
    const scratch = (win as { Scratch?: Record<string, unknown> }).Scratch;
    if (!scratch || typeof scratch !== 'object') return list;
    if (scratch.vm) list.push(scratch.vm);
    if (scratch.runtime) list.push({ runtime: scratch.runtime });
  } catch {}
  return list;
}

function m3HookCandidates(): unknown[] {
  const candidates: unknown[] = [];
  try {
    if (m3HookPage.__m3hookEditorVM) candidates.push(m3HookPage.__m3hookEditorVM);
    if (m3HookPage.vm) candidates.push(m3HookPage.vm);
  } catch {}
  for (const value of m3HookScratchCandidates(m3HookPage)) candidates.push(value);
  return candidates;
}

function m3HookIsRichVM(vm: M3HookVM): boolean {
  const runtime = vm.runtime as M3HookRuntimeLike | null;
  return Boolean(runtime && (runtime.ccwAPI || runtime._primitives));
}

function m3HookFirstVM(): M3HookVM | null {
  const vms = m3HookCandidates().filter(m3HookIsVM);
  return vms.find(m3HookIsRichVM) ?? vms[0] ?? null;
}

function m3HookBestVM(): M3HookVM | null {
  const vms = m3HookCandidates().filter(m3HookIsVM);
  const rich = vms.filter(m3HookIsRichVM);
  const pool = rich.length ? rich : vms;
  const injectable = pool.filter(
    (vm) => typeof (vm as { addSprite?: unknown }).addSprite === 'function',
  );
  for (const vm of injectable) {
    if (m3HookIsReadyVM(vm)) return vm;
  }
  return injectable[0] ?? pool[0] ?? null;
}

function m3HookAdoptVM(vm: M3HookVM): void {
  const canInject = (value: M3HookVM | null): boolean =>
    Boolean(value && typeof value.addSprite === 'function');
  if (m3HookEditorVM && (canInject(m3HookEditorVM) || !canInject(vm))) return;
  m3HookEditorVM = vm;
  m3HookStartCommunityPatchRetry();
  for (const listener of [...m3HookVMListeners]) {
    try {
      listener(vm);
    } catch {}
  }
}

export function onVM(listener: (vm: M3HookVM) => void): void {
  if (!m3HookEditorVM) {
    const vm = m3HookFirstVM();
    if (vm) m3HookAdoptVM(vm);
  }
  if (m3HookEditorVM) {
    try {
      listener(m3HookEditorVM);
    } catch {}
    return;
  }
  m3HookVMListeners.add(listener);
}

const m3HookVMPollTimer = setInterval(() => {
  if (!m3HookEditorVM) {
    const vm = m3HookFirstVM();
    if (vm) m3HookAdoptVM(vm);
  }
  if (m3HookEditorVM) clearInterval(m3HookVMPollTimer);
}, 200);
setTimeout(() => clearInterval(m3HookVMPollTimer), 60000);
m3HookOnCleanup(() => clearInterval(m3HookVMPollTimer));

function m3HookOid(): string {
  const matched = location.pathname.match(/\/detail\/([^/?#]+)/);
  return matched ? matched[1] : '';
}

const M3_HOOK_GH_OWNER = 'AetlaDev';//填写你的GitHub用户名
const M3_HOOK_GH_REPO = 'M3-Hook';//这里填写仓库名，只要不改仓库名这里就不需要改
const M3_HOOK_GH_BRANCH = 'main';

const M3_HOOK_SPRITE_LINE_KEY = 'm3-hook:sprite-line';

interface M3HookSpriteLine {
  name: string;
  url: string;
}

function m3HookSpriteLines(oid: string): M3HookSpriteLine[] {
  const owner = M3_HOOK_GH_OWNER;
  const repo = M3_HOOK_GH_REPO;
  const branch = M3_HOOK_GH_BRANCH;
  const path = `${owner}/${repo}/${branch}/hook/${oid}.sprite3`;
  const raw = `https://raw.githubusercontent.com/${path}`;
  const jsdelivr = (host: string): string =>
    `https://${host}/gh/${owner}/${repo}@${branch}/hook/${oid}.sprite3`;
  const lines: M3HookSpriteLine[] = [
    { name: 'github', url: raw },
    { name: 'jsdelivr', url: jsdelivr('cdn.jsdelivr.net') },
    { name: 'fastly', url: jsdelivr('fastly.jsdelivr.net') },
    { name: 'gcore', url: jsdelivr('gcore.jsdelivr.net') },
    { name: 'ghproxy', url: `https://ghproxy.net/${raw}` },
    { name: 'gitmirror', url: `https://raw.gitmirror.com/${path}` },
  ];
  return lines;
}

function m3HookRememberedLine(): string {
  try {
    return localStorage.getItem(M3_HOOK_SPRITE_LINE_KEY) ?? '';
  } catch {
    return '';
  }
}

function m3HookRememberLine(name: string): void {
  try {
    localStorage.setItem(M3_HOOK_SPRITE_LINE_KEY, name);
  } catch {}
}

async function m3HookFetchLine(url: string): Promise<Response | null> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    return await fetch(url, { cache: 'no-store', signal: controller?.signal });
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function m3HookLoadSprite(oid: string): Promise<ArrayBuffer | null> {
  const lines = m3HookSpriteLines(oid);
  const remembered = m3HookRememberedLine();
  const index = lines.findIndex((line) => line.name === remembered);
  const start = index >= 0 ? index : 0;
  for (let step = 0; step < lines.length; step += 1) {
    const line = lines[(start + step) % lines.length];
    const response = await m3HookFetchLine(line.url);
    if (!response) continue;
    if (response.status === 404) return null;
    if (!response.ok) continue;
    try {
      const buffer = await response.arrayBuffer();
      m3HookRememberLine(line.name);
      return buffer;
    } catch {
      continue;
    }
  }
  return null;
}

function m3HookDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type M3HookUserField =
  | 'id'
  | 'name'
  | 'uuid'
  | 'avatar'
  | 'constellation'
  | 'following'
  | 'followers'
  | 'liked'
  | 'gender';

interface M3HookTestUser {
  id: string;
  name: string;
  uuid: string;
  avatar: string;
  constellation: number;
  following: number;
  followers: number;
  liked: number;
  gender: number;
}

const M3_HOOK_FIELD_ALIASES: Record<M3HookUserField, string[]> = {
  id: ['id', '共创id', 'studentnumber', 'userid', '用户id', '编号'],
  name: ['name', 'username', 'nickname', '名字', '用户名', '昵称'],
  uuid: ['uuid', 'oid', 'studentoid', '唯一id', '唯一uuid', '用户唯一id'],
  avatar: ['avatar', 'picurl', '头像', '头像地址', '头像图片地址', '头像图片'],
  constellation: ['constellation', 'sign', 'zodiac', '星座', '星座编号'],
  following: ['following', 'followingcount', '关注', '关注数', '关注了多少人'],
  followers: ['followers', 'followercount', 'fans', '粉丝', '粉丝数'],
  liked: ['liked', 'like', 'likecount', '点赞', '点赞数', '被点赞数', '获赞数'],
  gender: ['gender', 'sex', '性别'],
};

const M3_HOOK_CONSTELLATION_BOUNDARIES = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22];

let m3HookTestOid = '';
let m3HookTestUser: M3HookTestUser | null = null;
let m3HookTestFailed = false;
let m3HookTestRequestId = 0;

function m3HookNormalizeField(value: string): string {
  return value.toLowerCase().replace(/[\s_\-?？。]/g, '');
}

const M3_HOOK_USERVALUE_FIELDS: M3HookUserField[] = [
  'id',
  'name',
  'uuid',
  'avatar',
  'constellation',
  'following',
  'followers',
  'liked',
  'gender',
];

function m3HookResolveUserField(args: unknown): M3HookUserField | null {
  if (args && typeof args === 'object') {
    const raw = (args as Record<string, unknown>).USERVALUE;
    if (typeof raw === 'number' || typeof raw === 'string') {
      const index = Number(raw);
      if (Number.isInteger(index) && index >= 1 && index <= M3_HOOK_USERVALUE_FIELDS.length) {
        return M3_HOOK_USERVALUE_FIELDS[index - 1];
      }
    }
  }

  const values: string[] = [];
  const collect = (value: unknown, depth: number): void => {
    if (depth > 2 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      values.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) collect(item, depth + 1);
    }
  };
  collect(args, 0);

  for (const value of values) {
    const key = m3HookNormalizeField(value);
    if (!key) continue;
    for (const field of Object.keys(M3_HOOK_FIELD_ALIASES) as M3HookUserField[]) {
      if (M3_HOOK_FIELD_ALIASES[field].some((alias) => m3HookNormalizeField(alias) === key)) {
        return field;
      }
    }
  }

  for (const value of values) {
    const key = m3HookNormalizeField(value);
    if (!key) continue;
    if (key.includes('星座')) return 'constellation';
    if (key.includes('头像')) return 'avatar';
    if (key.includes('粉丝')) return 'followers';
    if (key.includes('关注')) return 'following';
    if (key.includes('点赞')) return 'liked';
    if (key.includes('性别')) return 'gender';
    if (key.includes('唯一')) return 'uuid';
    if (key.includes('名字') || key.includes('昵称')) return 'name';
    if (key.includes('constellation') || key.includes('zodiac') || key.includes('sign')) return 'constellation';
    if (key.includes('avatar') || key.includes('picurl')) return 'avatar';
    if (key.includes('follower') || key.includes('fans')) return 'followers';
    if (key.includes('following')) return 'following';
    if (key.includes('like')) return 'liked';
    if (key.includes('gender') || key.includes('sex')) return 'gender';
    if (key.includes('studentnumber')) return 'id';
    if (key.includes('uuid')) return 'uuid';
    if (key.includes('oid')) return 'uuid';
    if (key.includes('name')) return 'name';
    if (key.includes('id')) return 'id';
  }
  return null;
}

function m3HookUserFieldValue(user: M3HookTestUser, field: M3HookUserField): string | number {
  return user[field];
}

function m3HookConstellation(birthday: number): number {
  if (!Number.isFinite(birthday) || birthday <= 0) return -1;
  const date = new Date(birthday);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let position = day < M3_HOOK_CONSTELLATION_BOUNDARIES[month - 1] ? month - 1 : month;
  position %= 12;
  return position === 0 ? 12 : position;
}

function m3HookPostJson(
  url: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const fetcher = m3HookPage.fetch;
  return new Promise((resolve) => {
    if (typeof fetcher !== 'function') {
      resolve(null);
      return;
    }
    fetcher
      .call(m3HookPage, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { body?: unknown } | null) => {
        const payload = data && data.body;
        resolve(payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null);
      })
      .catch(() => resolve(null));
  });
}

async function m3HookFetchTestUser(oid: string): Promise<M3HookTestUser | null> {
  const [profile, detail] = await Promise.all([
    m3HookPostJson('https://community-web.ccw.site/students/profile', { studentOid: oid }),
    m3HookPostJson('https://community-web.ccw.site/creation/student/detail', {
      studentOid: oid,
    }),
  ]);
  if (!profile && !detail) return null;

  const genderValue = String(profile?.gender ?? '');
  return {
    id: String(profile?.studentNumber ?? ''),
    name: String(profile?.name ?? detail?.name ?? ''),
    uuid: String(profile?.studentOid ?? detail?.oid ?? oid),
    avatar: String(profile?.avatar ?? detail?.avatar ?? detail?.picUrl ?? ''),
    constellation: m3HookConstellation(Number(profile?.birthday)),
    following: Number(detail?.followingCount ?? 0),
    followers: Number(detail?.followerCount ?? 0),
    liked: Number(detail?.likeCount ?? 0),
    gender: profile?.hideGender ? -1 : genderValue === 'MALE' ? 0 : genderValue === 'FEMALE' ? 1 : -1,
  };
}

const m3HookPrimitiveRestores: Array<() => void> = [];

type M3HookRuntimeLike = {
  _primitives?: Record<string, unknown>;
  _blockInfo?: Array<{ id?: unknown }>;
  targets?: unknown;
  getOpcodeFunction?: (opcode: string) => unknown;
  invalidateCompiledInstances?: () => void;
  ccwAPI?: Record<string, unknown>;
  __m3hookGetOpcodePatched?: boolean;
  __m3hookPatched?: boolean;
  __m3hookCacheOid?: string;
};

const m3HookCommunityWrappers = new WeakMap<Function, Function>();
let m3HookPatchFound = false;

function m3HookPlayerPayload(): Record<string, unknown> | null {
  const user = m3HookTestUser;
  if (!user) return null;
  return {
    userId: user.id,
    userName: user.name,
    uuid: user.uuid,
    oid: user.uuid,
    avatar: user.avatar,
    constellation: user.constellation,
    following: user.following,
    followers: user.followers,
    liked: user.liked,
    gender: user.gender,
    pendant: '',
    reputationScore: { score: 100 },
  };
}

const m3HookApiRestores: Array<() => void> = [];
let m3HookApiPatched = false;
let m3HookHostPatched = false;

function m3HookMakeFakeUserInfo(original: unknown): Function {
  const call = typeof original === 'function' ? (original as Function) : null;
  const wrapper = function (this: unknown, ...args: unknown[]): Promise<unknown> {
    const payload = m3HookPlayerPayload();
    if (!call) return Promise.resolve(payload);
    if (!payload) return Promise.resolve(call.apply(this, args));
    let result: Promise<unknown>;
    try {
      result = Promise.resolve(call.apply(this, args));
    } catch {
      return Promise.resolve(payload);
    }
    return result.then(
      (info) =>
        info && typeof info === 'object'
          ? Object.assign({}, info as Record<string, unknown>, payload)
          : payload,
      () => payload,
    );
  } as ((...args: unknown[]) => Promise<unknown>) & { __m3hookTest?: boolean };
  wrapper.__m3hookTest = true;
  return wrapper;
}

function m3HookWrapApi(api: unknown): boolean {
  if (!api || typeof api !== 'object') return false;
  const object = api as Record<string, unknown>;
  const original = object.getUserInfo;
  if (typeof original !== 'function') return false;
  if ((original as { __m3hookTest?: boolean }).__m3hookTest) return true;
  const wrapper = m3HookMakeFakeUserInfo(original);
  try {
    object.getUserInfo = wrapper;
  } catch {
    return false;
  }
  if (object.getUserInfo !== wrapper) return false;
  m3HookApiRestores.push(() => {
    if (object.getUserInfo === wrapper) object.getUserInfo = original;
  });
  return true;
}

function m3HookPatchRuntimeApi(vm: M3HookVM): boolean {
  const runtime = vm.runtime as M3HookRuntimeLike | null;
  if (!runtime || typeof runtime !== 'object') return false;
  return m3HookWrapApi(runtime.ccwAPI);
}

function m3HookIsCommunityOpcode(opcode: string): boolean {
  return /getuservalue/i.test(opcode);
}

interface M3HookCallRecord {
  opcode: string;
  args: string;
  field: string;
  fake: boolean;
}

const M3_HOOK_CALL_LOG_LIMIT = 20;
const m3HookCallLog: M3HookCallRecord[] = [];

function m3HookDescribeArgs(value: unknown): string {
  try {
    const json = JSON.stringify(value, (_key, item) =>
      typeof item === 'function' ? '[function]' : item,
    );
    if (!json) return String(value);
    return json.length > 240 ? `${json.slice(0, 240)}…` : json;
  } catch {
    return '[unserializable]';
  }
}

function m3HookLogCall(opcode: string, args: unknown, field: string | null, fake: boolean): void {
  if (m3HookCallLog.length >= M3_HOOK_CALL_LOG_LIMIT) return;
  try {
    m3HookCallLog.push({ opcode, args: m3HookDescribeArgs(args), field: field ?? '', fake });
  } catch {}
}

function m3HookWrapCommunityFunction(current: Function, opcode = ''): Function {
  if ((current as { __m3hookTest?: boolean }).__m3hookTest) return current;
  const cached = m3HookCommunityWrappers.get(current);
  if (cached) return cached;

  const wrapper = function (this: unknown, args?: unknown, util?: unknown): unknown {
    let field: M3HookUserField | null = null;
    try {
      field = m3HookResolveUserField(args);
    } catch {
      field = null;
    }
    const fake = Boolean(field && m3HookTestUser);
    m3HookLogCall(opcode, args, field, fake);
    if (fake && field) return m3HookUserFieldValue(m3HookTestUser as M3HookTestUser, field);
    return current.call(this, args, util);
  } as ((args?: unknown, util?: unknown) => unknown) & { __m3hookTest?: boolean };
  wrapper.__m3hookTest = true;
  m3HookCommunityWrappers.set(current, wrapper as Function);
  return wrapper as Function;
}

function m3HookPatchRuntimePrimitives(runtime: M3HookRuntimeLike | null): boolean {
  if (!runtime || typeof runtime !== 'object') return false;

  let found = false;
  const primitives = runtime._primitives;
  if (primitives && typeof primitives === 'object') {
    for (const key of Object.keys(primitives)) {
      if (!m3HookIsCommunityOpcode(key)) continue;
      const current = primitives[key];
      if (typeof current !== 'function') continue;
      found = true;
      const wrapper = m3HookWrapCommunityFunction(current as Function, key);
      if (wrapper === current) continue;
      primitives[key] = wrapper;
      m3HookPrimitiveRestores.push(() => {
        if (primitives[key] === wrapper) primitives[key] = current;
      });
    }
  }

  const originalGetOpcode = runtime.getOpcodeFunction;
  if (typeof originalGetOpcode === 'function' && !runtime.__m3hookGetOpcodePatched) {
    const patchedGetOpcode = function (this: unknown, opcode: string): unknown {
      const fn = originalGetOpcode.call(this, opcode);
      if (typeof fn !== 'function' || !m3HookIsCommunityOpcode(String(opcode))) return fn;
      return m3HookWrapCommunityFunction(fn as Function, String(opcode));
    };
    runtime.getOpcodeFunction = patchedGetOpcode;
    runtime.__m3hookGetOpcodePatched = true;
    m3HookPrimitiveRestores.push(() => {
      if (runtime.getOpcodeFunction === patchedGetOpcode) runtime.getOpcodeFunction = originalGetOpcode;
    });
  }

  if (found) {
    runtime.__m3hookPatched = true;
    m3HookInvalidateCaches(runtime);
  }
  return found;
}

function m3HookInvalidateCaches(runtime: M3HookRuntimeLike): void {
  if (runtime.__m3hookCacheOid === m3HookTestOid) return;
  runtime.__m3hookCacheOid = m3HookTestOid;
  try {
    runtime.invalidateCompiledInstances?.();
  } catch {}
}

let m3HookPatchTimer: number | null = null;

const m3HookSeenRuntimes = new Set<object>();

function m3HookAllVMs(): M3HookVM[] {
  const vms: M3HookVM[] = [];
  const runtimes: object[] = [];
  const push = (value: unknown): void => {
    if (!m3HookIsVM(value)) return;
    const runtime = (value as { runtime?: object }).runtime;
    if (!runtime || typeof runtime !== 'object') return;
    m3HookSeenRuntimes.add(runtime);
    if (runtimes.includes(runtime)) return;
    runtimes.push(runtime);
    vms.push(value);
  };
  for (const value of m3HookCandidates()) push(value);
  for (const win of m3HookAllWindows()) {
    for (const value of m3HookScratchCandidates(win)) push(value);
  }
  for (const runtime of m3HookSeenRuntimes) {
    if (runtimes.includes(runtime)) continue;
    runtimes.push(runtime);
    vms.push({ runtime } as M3HookVM);
  }
  return vms;
}

function m3HookApplyPatch(): { found: boolean; api: boolean } {
  let found = false;
  let api = false;
  for (const vm of m3HookAllVMs()) {
    if (m3HookPatchRuntimeApi(vm)) api = true;
    if (m3HookPatchRuntimePrimitives(vm.runtime as M3HookRuntimeLike | null)) found = true;
  }
  return { found, api };
}

function m3HookUpdateTestDebug(): void {
  const vms = m3HookAllVMs();
  const page = m3HookPage as M3HookPage & { __m3hookTestDebug?: unknown };
  const marked = (value: unknown): boolean =>
    Boolean(value && (value as { __m3hookTest?: boolean }).__m3hookTest);
  page.__m3hookTestDebug = {
    targetOid: m3HookTestOid,
    userLoaded: Boolean(m3HookTestUser),
    patched: m3HookPatchFound,
    apiPatched: m3HookApiPatched,
    hostPatched: m3HookHostPatched,
    calls: m3HookCallLog.slice(),
    vms: vms.map((vm) => {
      const runtime = vm.runtime as M3HookRuntimeLike | null;
      const keys = Object.keys(runtime?._primitives ?? {});
      const blockInfo = Array.isArray(runtime?._blockInfo) ? runtime._blockInfo : [];
      return {
        opcodes: keys.filter((key) => /community|kontakt|getuservalue/i.test(key)),
        extensions: blockInfo.map((info) => String(info?.id ?? '')).filter(Boolean),
        apiPatched: marked(runtime?.ccwAPI?.getUserInfo),
      };
    }),
  };
}

function m3HookStartCommunityPatchRetry(): void {
  if (m3HookPatchTimer !== null) return;
  m3HookPatchTimer = window.setInterval(() => {
    try {
      const result = m3HookApplyPatch();
      m3HookPatchFound = result.found || m3HookPatchFound;
      m3HookApiPatched = result.api || m3HookApiPatched;
      m3HookPublishPayload();
      m3HookUpdateTestDebug();
    } catch {}
  }, 1000);
}

m3HookStartCommunityPatchRetry();

export function setTestUserOid(oid: string): void {
  const next = oid.trim();
  if (next === m3HookTestOid && !(next && m3HookTestFailed)) return;
  m3HookTestOid = next;
  m3HookTestUser = null;
  m3HookTestFailed = false;
  m3HookPatchFound = false;
  m3HookApiPatched = false;
  const result = m3HookApplyPatch();
  m3HookPatchFound = result.found;
  m3HookApiPatched = result.api;
  m3HookStartCommunityPatchRetry();
  m3HookPublishPayload();
  m3HookUpdateTestDebug();
  if (!next) return;
  const requestId = ++m3HookTestRequestId;
  void m3HookFetchTestUser(next).then((user) => {
    if (requestId === m3HookTestRequestId) {
      m3HookTestUser = user;
      m3HookTestFailed = !user;
      m3HookPublishPayload();
      m3HookUpdateTestDebug();
    }
  });
}

m3HookOnCleanup(() => {
  if (m3HookPatchTimer !== null) {
    window.clearInterval(m3HookPatchTimer);
    m3HookPatchTimer = null;
  }
  while (m3HookPrimitiveRestores.length) {
    try {
      m3HookPrimitiveRestores.pop()?.();
    } catch {}
  }
  while (m3HookApiRestores.length) {
    try {
      m3HookApiRestores.pop()?.();
    } catch {}
  }
});

async function m3HookWaitProjectLoaded(timeoutMs = 60000): Promise<M3HookVM | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const vm = m3HookBestVM();
    if (vm && typeof vm.addSprite === 'function' && m3HookIsReadyVM(vm)) return vm;
    await m3HookDelay(250);
  }
  return null;
}

export async function autoInject(vm: M3HookVM): Promise<boolean> {
  try {
    const oid = m3HookOid();
    if (!oid) return false;
    const target = (await m3HookWaitProjectLoaded()) ?? vm;
    const buffer = await m3HookLoadSprite(oid);
    if (!buffer) return false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = m3HookBestVM() ?? target;
      try {
        if (typeof candidate.addSprite !== 'function') throw new Error('no addSprite');
        await candidate.addSprite(buffer);
        return true;
      } catch {
        await m3HookDelay(800);
      }
    }
    return false;
  } catch {
    return false;
  }
}

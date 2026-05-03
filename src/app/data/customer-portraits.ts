/**
 * 顾客头像：`src/assets/images/people/` 下 PNG。
 * 优先使用「显示名 + .png」（如 `杰克.png`），再尝试 ASCII 备用名（如 `jieke.png`）。
 */
export const CUSTOMER_NAMES = ['阿明', '小莉', '杰克', '美玲', '老周', '艾米'] as const;

export type CustomerDisplayName = (typeof CUSTOMER_NAMES)[number];

const SLUG: Record<CustomerDisplayName, string> = {
  阿明: 'aming.png',
  小莉: 'xiaoli.png',
  杰克: 'jieke.png',
  美玲: 'meiling.png',
  老周: 'laozhou.png',
  艾米: 'aimi.png',
};

const NAME_SET = new Set<string>(CUSTOMER_NAMES);

const PEOPLE_BASE = 'assets/images/people/p_';

/** 按顺序尝试，直到某张图加载成功或全部失败（显示首字占位） */
export function portraitUrlCandidates(displayName: string): string[] {
  const out: string[] = [];
  if (NAME_SET.has(displayName)) {
    out.push(`${PEOPLE_BASE}${encodeURIComponent(`${displayName}.png`)}`);
    const slug = SLUG[displayName as CustomerDisplayName];
    if (slug) {
      out.push(`${PEOPLE_BASE}${slug}`);
    }
  }
  out.push(`${PEOPLE_BASE}default.png`);
  return [...new Set(out)];
}

/** 仅第一个候选（兼容旧调用） */
export function portraitUrlForCustomer(displayName: string): string {
  const list = portraitUrlCandidates(displayName);
  return list[0] ?? `${PEOPLE_BASE}default.png`;
}

export function randomCustomerName(rng: () => number): string {
  const i = Math.floor(rng() * CUSTOMER_NAMES.length);
  return CUSTOMER_NAMES[i] ?? '顾客';
}

/** 从名字池中随机，但排除已在场（当前订单队列）的顾客名，避免同屏重复人物 */
export function randomCustomerNameExcluding(
  rng: () => number,
  excluded: ReadonlySet<string>,
): string {
  const pool = CUSTOMER_NAMES.filter((n) => !excluded.has(n));
  if (pool.length === 0) {
    return randomCustomerName(rng);
  }
  const i = Math.floor(rng() * pool.length);
  return pool[i] ?? '顾客';
}

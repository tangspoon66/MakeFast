/**
 * Shared board grouping constants and helpers.
 *
 * Used by BoardSelector, BoardDetectionCard, and SerialToolbar
 * to avoid duplicating chip family definitions.
 */

export interface ChipFamily {
  id: string;
  name: string;
  prefix: string;
  exclude?: string[];
}

/**
 * Chip family grouping configuration.
 * Boards are grouped by prefix match; the `exclude` array
 * prevents ambiguous prefix matches (e.g., "esp32" matches
 * "esp32s2", so we exclude sub-families).
 */
export const CHIP_FAMILIES: ChipFamily[] = [
  { id: 'esp32',     name: 'ESP32 系列',      prefix: 'esp32',  exclude: ['esp32s', 'esp32c', 'esp32h'] },
  { id: 'esp32-s2',  name: 'ESP32-S2 系列',   prefix: 'esp32s2' },
  { id: 'esp32-s3',  name: 'ESP32-S3 系列',   prefix: 'esp32s3' },
  { id: 'esp32-c3',  name: 'ESP32-C3 系列',   prefix: 'esp32c3' },
  { id: 'esp32-c6',  name: 'ESP32-C6 系列',   prefix: 'esp32c6' },
  { id: 'esp32-h2',  name: 'ESP32-H2 系列',   prefix: 'esp32h2' },
  { id: 'esp8266',   name: 'ESP8266 系列',    prefix: 'esp8266-' },
  { id: 'arduino',   name: 'Arduino 系列',    prefix: 'arduino-' },
];

export interface BoardSummary {
  id: string;
  name: string;
  chip_family?: string;
}

/**
 * Group a list of boards by chip family.
 * Returns only families that actually contain boards.
 */
export function groupBoardsByFamily(
  boards: BoardSummary[],
): { family: ChipFamily; boards: BoardSummary[] }[] {
  return CHIP_FAMILIES
    .map((family) => {
      const filtered = boards.filter((b) => {
        if (!b.id.startsWith(family.prefix)) return false;
        if (family.exclude) {
          return !family.exclude.some((ex) => b.id.includes(ex));
        }
        return true;
      });
      return { family, boards: filtered };
    })
    .filter((g) => g.boards.length > 0);
}

/**
 * Group boards into <optgroup> structure for <select> elements.
 * Reuses groupBoardsByFamily internally to guarantee consistent filtering,
 * then merges S2+S3 and C3+C6 for a more compact toolbar dropdown.
 */
export interface SelectOptGroup {
  label: string;
  boards: BoardSummary[];
}

export function getBoardOptGroups(boards: BoardSummary[]): SelectOptGroup[] {
  const famGroups = groupBoardsByFamily(boards);

  // 收集已被分组的板子 id，用于找"漏网之鱼"
  const groupedIds = new Set<string>();
  for (const g of famGroups) {
    for (const b of g.boards) {
      groupedIds.add(b.id);
    }
  }
  const orphans = boards.filter(b => !groupedIds.has(b.id));

  // 合并 S2+S3 为 "ESP32-S 系列", C3+C6 为 "ESP32-C 系列"
  const sBoards: BoardSummary[] = [];
  const cBoards: BoardSummary[] = [];
  const rest: SelectOptGroup[] = [];

  for (const g of famGroups) {
    if (g.family.id === 'esp32-s2' || g.family.id === 'esp32-s3') {
      sBoards.push(...g.boards);
    } else if (g.family.id === 'esp32-c3' || g.family.id === 'esp32-c6') {
      cBoards.push(...g.boards);
    } else {
      rest.push({ label: g.family.name, boards: g.boards });
    }
  }

  const result: SelectOptGroup[] = [];
  // rest[0] is ESP32 系列 (first in CHIP_FAMILIES)
  if (rest.length > 0 && rest[0].boards.length > 0) {
    result.push(rest[0]); // ESP32 系列
    if (sBoards.length) result.push({ label: 'ESP32-S 系列', boards: sBoards });
    if (cBoards.length) result.push({ label: 'ESP32-C 系列', boards: cBoards });
  }
  // Remaining groups (H, ESP8266, Arduino) keep their order
  result.push(...rest.slice(1));

  // 未匹配任何分组的板子放入"其他"分组
  if (orphans.length > 0) {
    result.push({ label: '其他开发板', boards: orphans });
  }

  return result.filter(g => g.boards.length > 0);
}

/**
 * Get the global 1-based ordinal for a board in the full list.
 * Used for teacher-student communication ("选第 7 号开发板").
 */
export function getBoardNumber(boardId: string, allBoards: BoardSummary[]): number | null {
  const idx = allBoards.findIndex(b => b.id === boardId);
  return idx >= 0 ? idx + 1 : null;
}

export function formatBoardNumberLabel(boardId: string, allBoards: BoardSummary[]): string {
  const n = getBoardNumber(boardId, allBoards);
  return n != null ? `${n}号板：` : '';
}

// chip_family → 显示名映射
const FAMILY_LABELS: Record<string, string> = {
  esp32: 'ESP32 系列',
  'esp32-s2': 'ESP32-S 系列', 'esp32-s3': 'ESP32-S 系列',
  'esp32-c3': 'ESP32-C 系列', 'esp32-c6': 'ESP32-C 系列',
  'esp32-h2': 'ESP32-H2 系列',
  esp8266: 'ESP8266 系列',
  avr: 'Arduino 系列',
};

/**
 * 按 chip_family 分组（当 BoardSummary 包含 chip_family 时优先使用）
 */
export function groupBoardsByChipFamily(boards: BoardSummary[]): SelectOptGroup[] {
  const groups = new Map<string, BoardSummary[]>();
  const order: string[] = [];
  for (const b of boards) {
    const cf = b.chip_family || '';
    const label = cf ? (FAMILY_LABELS[cf] || cf) : '其他开发板';
    if (!groups.has(label)) { groups.set(label, []); order.push(label); }
    groups.get(label)!.push(b);
  }
  // "其他"排最后
  if (order.includes('其他开发板')) {
    order.splice(order.indexOf('其他开发板'), 1);
    order.push('其他开发板');
  }
  return order.map(label => ({ label, boards: groups.get(label) || [] })).filter(g => g.boards.length > 0);
}

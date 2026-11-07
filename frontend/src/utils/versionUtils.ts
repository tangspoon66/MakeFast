/**
 * 版本管理工具函数
 * 
 * 提供语义化版本号的解析、比较、排序和分组功能。
 * 版本格式: major.minor.patch (如 1.2.3)
 */

/**
 * 解析语义化版本号
 * @param version 版本字符串 (如 "1.2.3")
 * @returns 解析后的版本对象，如果格式无效返回 null
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * 比较两个语义化版本号
 * @param a 版本 A
 * @param b 版本 B
 * @returns 正数表示 a > b，负数表示 a < b，0 表示相等
 */
export function compareVersions(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  // 无法解析的版本排在后面
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return 1;
  if (!parsedB) return -1;

  if (parsedA.major !== parsedB.major) return parsedA.major - parsedB.major;
  if (parsedA.minor !== parsedB.minor) return parsedA.minor - parsedB.minor;
  return parsedA.patch - parsedB.patch;
}

/**
 * 固件版本分组信息
 */
export interface FirmwareVersionGroup {
  projectName: string;
  latestVersion: string;
  latestFirmwareId: string;
  versions: Array<{
    version: string;
    firmwareId: string;
    isLatest: boolean;
    published: boolean;
    createdAt: string;
    downloadCount: number;
    flashCount: number;
    totalSize: number;
  }>;
}

/**
 * 按项目名称分组固件，并在每组内按版本降序排序
 * @param firmwares 固件列表
 * @returns 按项目名称分组的固件列表
 */
export function groupFirmwareByProject(
  firmwares: Array<{
    firmware_id: string;
    project_name: string;
    version: string;
    published: boolean;
    created_at: string;
    download_count: number;
    flash_count: number;
    total_size: number;
  }>
): FirmwareVersionGroup[] {
  // 按项目名称分组
  const groups = new Map<string, typeof firmwares>();

  for (const firmware of firmwares) {
    const existing = groups.get(firmware.project_name);
    if (existing) {
      existing.push(firmware);
    } else {
      groups.set(firmware.project_name, [firmware]);
    }
  }

  // 转换为结果数组
  const result: FirmwareVersionGroup[] = [];

  for (const [projectName, items] of groups) {
    // 按版本降序排序
    const sorted = [...items].sort((a, b) => compareVersions(b.version, a.version));

    const latestItem = sorted[0];

    result.push({
      projectName,
      latestVersion: latestItem.version,
      latestFirmwareId: latestItem.firmware_id,
      versions: sorted.map((item, index) => ({
        version: item.version,
        firmwareId: item.firmware_id,
        isLatest: index === 0,
        published: item.published,
        createdAt: item.created_at,
        downloadCount: item.download_count,
        flashCount: item.flash_count,
        totalSize: item.total_size,
      })),
    });
  }

  // 按最新版本的创建时间降序排序分组
  result.sort((a, b) => {
    const aTime = a.versions[0]?.createdAt || '';
    const bTime = b.versions[0]?.createdAt || '';
    return bTime.localeCompare(aTime);
  });

  return result;
}

/**
 * 检测版本冲突
 * @param existingFirmwares 已有的固件列表
 * @param projectName 项目名称
 * @param newVersion 新版本号
 * @returns 冲突信息，如果没有冲突返回 null
 */
export function detectVersionConflict(
  existingFirmwares: Array<{ project_name: string; version: string; firmware_id: string }>,
  projectName: string,
  newVersion: string
): { conflictingFirmwareId: string; existingVersion: string } | null {
  const conflict = existingFirmwares.find(
    (f) => f.project_name === projectName && f.version === newVersion
  );

  if (conflict) {
    return {
      conflictingFirmwareId: conflict.firmware_id,
      existingVersion: conflict.version,
    };
  }

  return null;
}

/**
 * 验证新版本是否大于所有已有版本
 * @param existingVersions 已有的版本列表
 * @param newVersion 新版本号
 * @returns true 如果新版本大于所有已有版本
 */
export function isVersionGreaterThanAll(existingVersions: string[], newVersion: string): boolean {
  if (existingVersions.length === 0) return true;

  for (const existing of existingVersions) {
    if (compareVersions(newVersion, existing) <= 0) {
      return false;
    }
  }

  return true;
}

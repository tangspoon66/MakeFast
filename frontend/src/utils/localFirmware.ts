export type LocalFirmwareRole = 'merged' | 'bootloader' | 'partitions' | 'boot_app0' | 'app' | 'unknown';
export type LocalFirmwareType = 'merged' | 'app' | 'multi' | 'unknown';
export type FirmwareConfidence = 'high' | 'medium' | 'low';

export interface LocalFirmwareInput {
  name: string;
  size: number;
  features?: FirmwareBinaryFeatures;
}

export interface FirmwareBinaryFeatures {
  imageAt0: boolean;
  imageAt1000: boolean;
  partitionAt8000: boolean;
  imageAt10000: boolean;
}

export interface LocalFirmwareFile {
  id: string;
  name: string;
  size: number;
  address: number;
  role: LocalFirmwareRole;
  file: File;
}

export interface LocalFirmwareAnalysis {
  firmwareType: LocalFirmwareType;
  confidence: FirmwareConfidence;
  reason: string;
  warnings: string[];
  files: Array<{
    name: string;
    address: number;
    role: LocalFirmwareRole;
  }>;
}

const ESP_NEW_BOOTLOADER_ZERO = ['esp32s2', 'esp32s3', 'esp32c3', 'esp32c6', 'esp32h2'];


const readFileBytes = async (file: File, start: number, length: number): Promise<Uint8Array> => {
  if (file.size <= start) return new Uint8Array();
  return new Uint8Array(await file.slice(start, Math.min(file.size, start + length)).arrayBuffer());
};

const hasEspImageMagic = (bytes: Uint8Array) => bytes.length > 0 && bytes[0] === 0xe9;
const hasPartitionMagic = (bytes: Uint8Array) => bytes.length >= 2 && bytes[0] === 0xaa && bytes[1] === 0x50;

export async function inspectFirmwareBinary(file: File): Promise<FirmwareBinaryFeatures> {
  const [at0, at1000, at8000, at10000] = await Promise.all([
    readFileBytes(file, 0x0, 8),
    readFileBytes(file, 0x1000, 8),
    readFileBytes(file, 0x8000, 8),
    readFileBytes(file, 0x10000, 8),
  ]);
  return {
    imageAt0: hasEspImageMagic(at0),
    imageAt1000: hasEspImageMagic(at1000),
    partitionAt8000: hasPartitionMagic(at8000),
    imageAt10000: hasEspImageMagic(at10000),
  };
}

export async function analyzeLocalFirmwareFiles(
  files: File[],
  options?: { boardId?: string; boardName?: string; chipFamily?: string }
): Promise<LocalFirmwareAnalysis> {
  const inputs = await Promise.all(files.map(async (file) => ({
    name: file.name,
    size: file.size,
    features: await inspectFirmwareBinary(file),
  })));
  return analyzeLocalFirmware(inputs, options);
}

export const formatHexAddress = (address: number) => `0x${address.toString(16)}`;

export const parseHexAddress = (value: string): number | null => {
  const trimmed = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(trimmed) && !/^[0-9a-f]+$/.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const getBootloaderAddress = (boardId?: string, chipFamily?: string): number => {
  const normalized = `${boardId || ''} ${chipFamily || ''}`.toLowerCase().replace(/[-_\s]/g, '');
  if (ESP_NEW_BOOTLOADER_ZERO.some((key) => normalized.includes(key))) {
    return 0x0;
  }
  return 0x1000;
};

const detectRole = (name: string): LocalFirmwareRole => {
  const lower = name.toLowerCase();
  if (lower.includes('boot_app0')) return 'boot_app0';
  if (lower.includes('partition')) return 'partitions';
  if (lower.includes('bootloader')) return 'bootloader';
  if (/(merged|merge|combined|complete|full|factory|xiaozhi|all)[._-]?.*\.bin$/.test(lower)) return 'merged';
  if (/(^|[._-])(app|firmware|sketch)([._-]|$)/.test(lower) || lower.endsWith('.ino.bin')) return 'app';
  return 'unknown';
};

const roleAddress = (role: LocalFirmwareRole, boardId?: string, chipFamily?: string): number => {
  switch (role) {
    case 'bootloader':
      return getBootloaderAddress(boardId, chipFamily);
    case 'partitions':
      return 0x8000;
    case 'boot_app0':
      return 0xe000;
    case 'app':
      return 0x10000;
    case 'merged':
      return 0x0;
    default:
      return 0x0;
  }
};

export function analyzeLocalFirmware(
  files: LocalFirmwareInput[],
  options?: { boardId?: string; boardName?: string; chipFamily?: string }
): LocalFirmwareAnalysis {
  const binFiles = files.filter((file) => file.name.toLowerCase().endsWith('.bin'));
  if (binFiles.length === 0) {
    return {
      firmwareType: 'unknown',
      confidence: 'low',
      reason: '没有找到 .bin 固件文件。',
      warnings: ['请上传 .bin 固件文件。'],
      files: [],
    };
  }

  const roles = binFiles.map((file) => ({ ...file, role: detectRole(file.name) }));
  const warnings: string[] = [];
  const lowerBoard = `${options?.boardId || ''} ${options?.boardName || ''}`.toLowerCase().replace(/[-_\s]/g, '');
  const joinedNames = binFiles.map((file) => file.name.toLowerCase()).join(' ').replace(/[-_\s]/g, '');
  for (const key of ['esp32s3', 'esp32c3', 'esp32c6', 'esp32s2']) {
    if (joinedNames.includes(key) && lowerBoard && !lowerBoard.includes(key)) {
      warnings.push(`文件名像 ${key.toUpperCase()}，请确认板子。`);
      break;
    }
  }

  if (roles.length === 1) {
    const file = roles[0];
    const features = file.features;
    const looksMergedByContent = Boolean(features?.partitionAt8000 || features?.imageAt10000 || (features?.imageAt0 && features?.imageAt1000));
    const looksLikeSingleImage = Boolean(features?.imageAt0 && !features?.partitionAt8000 && !features?.imageAt10000);
    const role = file.role === 'unknown'
      ? (looksMergedByContent || file.size >= 1024 * 1024 ? 'merged' : 'app')
      : file.role;
    const firmwareType: LocalFirmwareType = role === 'app' ? 'app' : 'merged';
    const confidence: FirmwareConfidence = looksMergedByContent || file.role !== 'unknown'
      ? 'high'
      : file.size >= 1024 * 1024 || looksLikeSingleImage
        ? 'medium'
        : 'low';
    if (confidence === 'low') {
      warnings.push('不太确定，烧录前看一下来源说明。');
    } else if (confidence === 'medium') {
      warnings.push('系统只是初步判断，最好再确认一下。');
    }
    return {
      firmwareType,
      confidence,
      reason: role === 'merged'
        ? '像完整固件，地址填 0x0。'
        : '像应用固件，地址填 0x10000。',
      warnings,
      files: [{ name: file.name, address: roleAddress(role, options?.boardId, options?.chipFamily), role }],
    };
  }

  const knownCount = roles.filter((file) => file.role !== 'unknown' && file.role !== 'merged').length;
  const sortedRoles = [...roles].sort((a, b) =>
    roleAddress(a.role, options?.boardId, options?.chipFamily) - roleAddress(b.role, options?.boardId, options?.chipFamily)
  );
  if (knownCount === 0) {
    warnings.push('有些文件认不准，请确认地址。');
  }

  return {
    firmwareType: 'multi',
    confidence: knownCount === roles.length ? 'high' : knownCount > 0 ? 'medium' : 'low',
    reason: '像多文件固件，地址已填好。',
    warnings,
    files: sortedRoles.map((file) => ({
      name: file.name,
      address: roleAddress(file.role, options?.boardId, options?.chipFamily),
      role: file.role,
    })),
  };
}

export function filesToLocalFirmwareFiles(
  files: File[],
  analysis: LocalFirmwareAnalysis
): LocalFirmwareFile[] {
  const validFiles = files.filter((file) => file.name.toLowerCase().endsWith('.bin'));
  return validFiles.map((file, index) => {
    const item = analysis.files.find((candidate) => candidate.name === file.name) || analysis.files[index];
    return {
      id: `local-fw-${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      address: Number.isFinite(item?.address) ? item.address : 0x0,
      role: item?.role || 'unknown',
      file,
    };
  });
}


export interface FirmwareAiSuggestion {
  name: string;
  address: number;
  role?: LocalFirmwareRole;
}

const normalizeAiAddress = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') return parseHexAddress(value);
  return null;
};

export function parseFirmwareAiSuggestions(text: string): FirmwareAiSuggestion[] {
  const candidates: string[] = [];
  const fencedMatches = text.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  for (const fenced of fencedMatches) {
    candidates.push(fenced.replace(/```(?:json)?/i, '').replace(/```$/, '').trim());
  }
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(text.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(text.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const rawFiles = Array.isArray(parsed) ? parsed : parsed.files;
      if (!Array.isArray(rawFiles)) continue;
      const suggestions = rawFiles.flatMap((item: any) => {
        if (!item || typeof item.name !== 'string') return [];
        const address = normalizeAiAddress(item.address ?? item.addr ?? item.flash_address);
        if (address === null) return [];
        return [{
          name: item.name,
          address,
          role: typeof item.role === 'string' ? item.role as LocalFirmwareRole : undefined,
        }];
      });
      if (suggestions.length > 0) return suggestions;
    } catch {
      // Try the next JSON candidate.
    }
  }
  return [];
}


export function stripFirmwareAiJson(text: string): string {
  let cleaned = text.replace(/```json\s*[\s\S]*?"files"\s*:\s*\[[\s\S]*?```/gi, '').trim();
  cleaned = cleaned.replace(/```\s*\{[\s\S]*?"files"\s*:\s*\[[\s\S]*?\}\s*```/gi, '').trim();
  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart && cleaned.slice(objectStart, objectEnd + 1).includes('"files"')) {
    cleaned = `${cleaned.slice(0, objectStart)}${cleaned.slice(objectEnd + 1)}`.trim();
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

export function summarizeFirmwareSuggestion(
  files: Array<{ name: string; address: number; role?: LocalFirmwareRole }>,
  fallbackText: string
): string {
  if (files.length === 0) {
    return stripFirmwareAiJson(fallbackText) || '我没有可靠识别出地址，请先不要烧录，建议查看固件来源说明。';
  }
  const first = files[0];
  if (files.length === 1) {
    const label = first.address === 0x0
      ? '这是完整固件'
      : first.address === 0x10000
        ? '这是应用固件'
        : '这是单个固件文件';
    return `${label}。我已经把 ${first.name} 的烧录地址填成 ${formatHexAddress(first.address)}。\n\n下一步：确认顶部选择的开发板和你的实际板子一致，然后点击右侧“烧录固件”。`;
  }
  const lines = files.map((file) => `- ${file.name} → ${formatHexAddress(file.address)}`).join('\n');
  return `这是多文件固件。我已经按常见 ESP 分区方式填好地址：\n${lines}\n\n下一步：确认文件都来自同一个项目和同一块开发板，然后点击右侧“烧录固件”。`;
}

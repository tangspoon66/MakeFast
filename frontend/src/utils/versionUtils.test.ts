/**
 * 版本管理工具函数测试
 */

import { describe, it, expect } from 'vitest';
import {
  parseVersion,
  compareVersions,
  groupFirmwareByProject,
  detectVersionConflict,
  isVersionGreaterThanAll,
} from './versionUtils';

describe('parseVersion', () => {
  it('should parse valid semantic version', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
  });

  it('should return null for invalid versions', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('1.2.3.4')).toBeNull();
    expect(parseVersion('abc')).toBeNull();
    expect(parseVersion('v1.2.3')).toBeNull();
    expect(parseVersion('1.2.x')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('should compare major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('should compare minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('should compare patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('should handle invalid versions gracefully', () => {
    // Invalid versions sort after valid ones
    expect(compareVersions('1.0.0', 'invalid')).toBeLessThan(0);
    expect(compareVersions('invalid', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('invalid', 'also-invalid')).toBe(0);
  });
});

describe('groupFirmwareByProject', () => {
  const mockFirmwares = [
    {
      firmware_id: 'id1',
      project_name: 'ProjectA',
      version: '1.0.0',
      published: true,
      created_at: '2024-01-01T00:00:00Z',
      download_count: 10,
      flash_count: 5,
      total_size: 1024,
    },
    {
      firmware_id: 'id2',
      project_name: 'ProjectA',
      version: '2.0.0',
      published: true,
      created_at: '2024-02-01T00:00:00Z',
      download_count: 20,
      flash_count: 10,
      total_size: 2048,
    },
    {
      firmware_id: 'id3',
      project_name: 'ProjectA',
      version: '1.1.0',
      published: false,
      created_at: '2024-01-15T00:00:00Z',
      download_count: 5,
      flash_count: 2,
      total_size: 1536,
    },
    {
      firmware_id: 'id4',
      project_name: 'ProjectB',
      version: '1.0.0',
      published: true,
      created_at: '2024-03-01T00:00:00Z',
      download_count: 30,
      flash_count: 15,
      total_size: 4096,
    },
  ];

  it('should group firmwares by project name', () => {
    const groups = groupFirmwareByProject(mockFirmwares);
    expect(groups).toHaveLength(2);
    
    const projectA = groups.find(g => g.projectName === 'ProjectA');
    const projectB = groups.find(g => g.projectName === 'ProjectB');
    
    expect(projectA).toBeDefined();
    expect(projectB).toBeDefined();
    expect(projectA!.versions).toHaveLength(3);
    expect(projectB!.versions).toHaveLength(1);
  });

  it('should sort versions within each group in descending order', () => {
    const groups = groupFirmwareByProject(mockFirmwares);
    const projectA = groups.find(g => g.projectName === 'ProjectA')!;
    
    expect(projectA.versions[0].version).toBe('2.0.0');
    expect(projectA.versions[1].version).toBe('1.1.0');
    expect(projectA.versions[2].version).toBe('1.0.0');
  });

  it('should mark the latest version correctly', () => {
    const groups = groupFirmwareByProject(mockFirmwares);
    const projectA = groups.find(g => g.projectName === 'ProjectA')!;
    
    expect(projectA.latestVersion).toBe('2.0.0');
    expect(projectA.latestFirmwareId).toBe('id2');
    expect(projectA.versions[0].isLatest).toBe(true);
    expect(projectA.versions[1].isLatest).toBe(false);
    expect(projectA.versions[2].isLatest).toBe(false);
  });

  it('should handle empty input', () => {
    const groups = groupFirmwareByProject([]);
    expect(groups).toHaveLength(0);
  });

  it('should handle single firmware', () => {
    const groups = groupFirmwareByProject([mockFirmwares[0]]);
    expect(groups).toHaveLength(1);
    expect(groups[0].versions).toHaveLength(1);
    expect(groups[0].versions[0].isLatest).toBe(true);
  });
});

describe('detectVersionConflict', () => {
  const existingFirmwares = [
    { project_name: 'ProjectA', version: '1.0.0', firmware_id: 'id1' },
    { project_name: 'ProjectA', version: '2.0.0', firmware_id: 'id2' },
    { project_name: 'ProjectB', version: '1.0.0', firmware_id: 'id3' },
  ];

  it('should detect conflict when same project + version exists', () => {
    const result = detectVersionConflict(existingFirmwares, 'ProjectA', '1.0.0');
    expect(result).not.toBeNull();
    expect(result!.conflictingFirmwareId).toBe('id1');
    expect(result!.existingVersion).toBe('1.0.0');
  });

  it('should return null when no conflict', () => {
    const result = detectVersionConflict(existingFirmwares, 'ProjectA', '3.0.0');
    expect(result).toBeNull();
  });

  it('should not conflict with different project names', () => {
    const result = detectVersionConflict(existingFirmwares, 'ProjectC', '1.0.0');
    expect(result).toBeNull();
  });
});

describe('isVersionGreaterThanAll', () => {
  it('should return true when version is greater than all existing', () => {
    expect(isVersionGreaterThanAll(['1.0.0', '1.1.0', '2.0.0'], '3.0.0')).toBe(true);
    expect(isVersionGreaterThanAll(['1.0.0'], '1.0.1')).toBe(true);
  });

  it('should return false when version is not greater than all', () => {
    expect(isVersionGreaterThanAll(['1.0.0', '2.0.0'], '1.5.0')).toBe(false);
    expect(isVersionGreaterThanAll(['1.0.0'], '1.0.0')).toBe(false);
    expect(isVersionGreaterThanAll(['2.0.0'], '1.0.0')).toBe(false);
  });

  it('should return true for empty existing versions', () => {
    expect(isVersionGreaterThanAll([], '1.0.0')).toBe(true);
  });
});

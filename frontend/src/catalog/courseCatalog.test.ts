import { describe, expect, it } from 'vitest';
import {
  CATALOG_COURSES,
  DEFAULT_CATALOG_FILTER,
  filterCatalogCourses,
} from './courseCatalog';

describe('courseCatalog S0', () => {
  it('defaults filter to 入门教程', () => {
    expect(DEFAULT_CATALOG_FILTER).toBe('入门教程');
  });

  it('pins first lesson with 开始这里 and Chinese title', () => {
    const first = filterCatalogCourses(CATALOG_COURSES, '入门教程')[0];
    expect(first.startHere).toBe(true);
    expect(first.title).toContain('温湿度');
    expect(first.boardTags).toContain('ESP32');
    expect(first.levelLabel).toBe('入门');
  });

  it('filters by board tag', () => {
    const esp = filterCatalogCourses(CATALOG_COURSES, 'ESP32');
    expect(esp.every((c) => c.boardTags.includes('ESP32'))).toBe(true);
  });
});

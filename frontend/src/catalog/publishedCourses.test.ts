import { describe, it, expect } from 'vitest';
import { mergePublished } from './publishedCourses';
import { CATALOG_COURSES } from './courseCatalog';

describe('已发布课程合并', () => {
  it('后端不可用 → 内置目录', () => { expect(mergePublished(null)).toBe(CATALOG_COURSES); });
  it('后台发布的课程出现在目录，第一课始终可开始，其它显示即将开放', () => {
    const list = mergePublished([{ slug: 'first-lesson', title: '第一课：温湿度小管家' }, { slug: 'course-servo-wave', title: '舵机', level: '进阶', board_id: 'esp32' }]);
    expect(list[0].startHere).toBe(true);
    expect(list[0].title).toBe('第一课：温湿度小管家');
    // 有课包的第二课「排错小侦探」始终可开始
    expect(list[1]).toMatchObject({ slug: 'debug-detective' });
    expect(list[1].comingSoon).toBeFalsy();
    expect(list[2]).toMatchObject({ slug: 'course-servo-wave', comingSoon: true, levelLabel: '进阶' });
  });
  it('后台没发布第一课也保留内置第一课', () => { expect(mergePublished([])[0].startHere).toBe(true); });
});

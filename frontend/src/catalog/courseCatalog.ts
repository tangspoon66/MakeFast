/**
 * S0 static course catalog (mock). Backend list can replace this later.
 */

export type CourseCategory = '入门教程' | '进阶挑战' | '创意作品';

export interface CatalogCourse {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  coverEmoji: string;
  difficultyStars: 1 | 2 | 3 | 4 | 5;
  levelLabel: '入门' | '进阶' | '挑战';
  boardTags: string[];
  category: CourseCategory;
  description: string;
  /** Pin first lesson with「开始这里」 */
  startHere: boolean;
  materialsHint: string;
  /** 后台已发布、但工作台课包尚未上线：按钮显示「即将开放」 */
  comingSoon?: boolean;
}

export const CATALOG_FILTERS = ['入门教程', '全部', 'ESP32', 'Arduino'] as const;
export type CatalogFilterId = (typeof CATALOG_FILTERS)[number];

export const DEFAULT_CATALOG_FILTER: CatalogFilterId = '入门教程';

export const CATALOG_COURSES: CatalogCourse[] = [
  {
    id: 'course-temp-buzzer',
    slug: 'temperature-alert',
    title: '第一课：温湿度小管家（XIAO ESP32-S3）',
    coverUrl: '/boards/xiao-esp32-s3/cover.webp',
    coverEmoji: '🌡️',
    difficultyStars: 1,
    levelLabel: '入门',
    boardTags: ['ESP32', 'Arduino'],
    category: '入门教程',
    description: '用 XIAO ESP32-S3、温湿度传感器和有源蜂鸣器，做出会感知环境并发出提醒的第一课作品。',
    startHere: true,
    materialsHint: 'XIAO ESP32-S3 · DHT22 · 有源蜂鸣器',
  },
  {
    id: 'course-debug-detective',
    slug: 'debug-detective',
    title: '第二课：排错小侦探（读懂报错）',
    coverUrl: null,
    coverEmoji: '🕵️',
    difficultyStars: 2,
    levelLabel: '进阶',
    boardTags: ['ESP32', 'Arduino'],
    category: '进阶挑战',
    description: '同一套硬件，程序里藏了 3 个 bug。跟着小铁猫读懂报错、跳到出错那一行，一个个修好。',
    startHere: false,
    materialsHint: '和第一课相同：XIAO ESP32-S3 · DHT22 · 有源蜂鸣器',
  },
  {
    id: 'course-led-blink',
    slug: 'led-blink-intro',
    title: '点亮第一盏 LED',
    coverUrl: null,
    coverEmoji: '💡',
    difficultyStars: 1,
    levelLabel: '入门',
    boardTags: ['Arduino', 'ESP32'],
    category: '入门教程',
    description: '认识开发板与面包板，学会点亮一盏灯（占位课程，后续开放）。',
    startHere: false,
    materialsHint: '开发板 · LED · 电阻',
  },
  {
    id: 'course-servo-wave',
    slug: 'servo-wave',
    title: '舵机挥手小机器人',
    coverUrl: null,
    coverEmoji: '🤖',
    difficultyStars: 2,
    levelLabel: '进阶',
    boardTags: ['ESP32'],
    category: '进阶挑战',
    description: '控制舵机做出挥手动作（占位课程）。',
    startHere: false,
    materialsHint: 'ESP32 · 舵机',
  },
];

export function filterCatalogCourses(
  courses: CatalogCourse[],
  filter: CatalogFilterId,
): CatalogCourse[] {
  let list = courses;
  if (filter === '入门教程') {
    list = courses.filter((c) => c.category === '入门教程');
  } else if (filter === 'ESP32') {
    list = courses.filter((c) => c.boardTags.includes('ESP32'));
  } else if (filter === 'Arduino') {
    list = courses.filter((c) => c.boardTags.includes('Arduino'));
  }
  // startHere first, then keep relative order
  return [...list].sort((a, b) => Number(b.startHere) - Number(a.startHere));
}

/** 第一课课程工作台入口（P0 本地 session） */
export const FIRST_LESSON_WORKBENCH = '/workbench?course=first-lesson';

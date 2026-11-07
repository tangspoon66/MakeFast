/** 路由 → 标签标题 */
const TITLES: [RegExp, string][] = [
  [/^\/$/, '欢迎'],
  [/^\/home/, '学习主页'],
  [/^\/courses\/[^/]+/, '课文章节'],
  [/^\/courses/, '课程目录'],
  [/^\/workbench.*mode=free/, '自由创作'],
  [/^\/(workbench|editor)/, '工作台'],
  [/^\/login/, '登录'],
  [/^\/register/, '注册'],
  [/^\/dashboard/, '我的学习'],
  [/^\/project/, '我的作品'],
  [/^\/library/, '课程预览'],
  [/^\/admin\/login/, '管理员登录'],
  [/^\/admin/, '管理后台'],
];

export function titleFor(path: string): string {
  const hit = TITLES.find(([rx]) => rx.test(path));
  return hit ? `${hit[1]} · MakeFast 一键造物` : 'MakeFast 一键造物';
}


/** 课文章节：所见即所得文档（HTML）按年龄档三份 + 资料 */
import type { AgeTier } from '../ageTier';
export type { AgeTier };

export interface ArticleResource {
  id: string;
  name: string;
  kind: 'pdf' | 'stl' | 'link';
  url: string;
  note?: string;
}

/** 主格式：docs[tier] = TipTap/HTML 文档 */
export interface CourseArticle {
  slug: string;
  courseId: string;
  title: string;
  cover?: string;
  subtitle: Record<AgeTier, string>;
  /** 三档所见即所得正文 */
  docs: Record<AgeTier, string>;
  bilibili: { bvid: string; title: string };
  resources: ArticleResource[];
  workbenchPath: string;
  /** 兼容旧块格式（迁移用，学生端不再依赖） */
  chapters?: unknown;
}

export const AGE_TAB_LABEL: Record<AgeTier, string> = {
  low: '小学',
  mid: '初中',
  high: '高中+',
};

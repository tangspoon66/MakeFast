import { workbenchLinkForMeta } from '../lesson/lessonRegistry';
/**
 * 学生端课程目录：读取管理员后台「已发布」的课程（/api/course-agent/courses）。
 * 后端不可用时退回内置 CATALOG_COURSES（第一课始终可用，课包本体仍是 FIRST_LESSON_PACK）。
 */
import { useEffect, useState } from 'react';
import { CATALOG_COURSES, type CatalogCourse } from './courseCatalog';

export interface ConsoleCourse {
  slug: string; title: string; level?: string; summary?: string; cover?: string | null;
  board_id?: string; status?: string; steps?: { id: string; title: string; why?: string }[];
}

const LEVEL: Record<string, CatalogCourse['levelLabel']> = { 入门: '入门', 进阶: '进阶', 熟练: '挑战', 挑战: '挑战' };
const EMOJI = ['💡', '🤖', '🌙', '🔍', '⛅', '🎵'];

export function mergePublished(published: ConsoleCourse[] | null): CatalogCourse[] {
  if (!published) return CATALOG_COURSES;
  const first = CATALOG_COURSES.find((c) => c.startHere)!;
  const out: CatalogCourse[] = [];
  const fl = published.find((p) => p.slug === 'first-lesson');
  out.push(fl ? { ...first, title: fl.title || first.title, description: fl.summary || first.description } : first);
  for (const c of CATALOG_COURSES) if (!c.startHere && workbenchLinkForMeta(c.id)) out.push(c);
  published.filter((p) => p.slug !== 'first-lesson' && typeof p.slug === 'string' && !out.some((c) => c.slug === p.slug)).forEach((p, i) => {
    const level = LEVEL[p.level || ''] ?? '进阶';
    out.push({
      id: p.slug, slug: p.slug, title: String(p.title || p.slug).slice(0, 40), coverUrl: p.cover && p.cover.startsWith('/') ? p.cover : null,
      coverEmoji: EMOJI[i % EMOJI.length], difficultyStars: level === '入门' ? 1 : level === '进阶' ? 2 : 3, levelLabel: level,
      boardTags: /esp32/i.test(p.board_id || '') ? ['ESP32', 'Arduino'] : ['Arduino'],
      category: level === '入门' ? '入门教程' : '进阶挑战', description: String(p.summary || '').slice(0, 120),
      startHere: false, materialsHint: '', comingSoon: true,
    });
  });
  return out;
}

let cache: ConsoleCourse[] | null | undefined;

export async function fetchPublishedCourses(): Promise<ConsoleCourse[] | null> {
  if (cache !== undefined) return cache;
  try {
    const r = await fetch('/api/course-agent/courses');
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    cache = Array.isArray(d?.courses) ? d.courses : null;
  } catch {
    cache = null;
  }
  return cache ?? null;
}

export function __resetPublishedCache() { cache = undefined; }

/** 目录 / Hub 用：先显示内置目录，拿到后台数据后替换 */
export function useCatalogCourses(): CatalogCourse[] {
  const [list, setList] = useState<CatalogCourse[]>(CATALOG_COURSES);
  useEffect(() => {
    let alive = true;
    void fetchPublishedCourses().then((p) => { if (alive) setList(mergePublished(p)); });
    return () => { alive = false; };
  }, []);
  return list;
}

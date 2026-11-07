/**
 * 第一课图文样例：TipTap/HTML 三档文档。
 */
import type { CourseArticle } from './types';
import { FIRST_LESSON_DOCS } from './firstLessonHtml';

const BOARD = '/boards/xiao-esp32-s3';

export const FIRST_LESSON_ARTICLE: CourseArticle = {
  slug: 'first-lesson',
  courseId: 'first-lesson',
  title: '温湿度小管家',
  cover: `${BOARD}/cover.webp`,
  subtitle: {
    low: '做一个会感觉冷热的小帮手 🌡️',
    mid: '用传感器读温湿度，太热就响一声',
    high: 'XIAO ESP32-S3 + DHT22 + 有源蜂鸣器：感知 → 判断 → 输出',
  },
  docs: { ...FIRST_LESSON_DOCS },
  bilibili: { bvid: 'BV1xx411c7mD', title: '（占位）第一课实操导览 — 请替换为真实稿件' },
  resources: [
    { id: 'pdf-wiring', name: '接线图说明（PDF）', kind: 'pdf', url: '/course-resources/first-lesson/wiring.pdf', note: '后台上传后可下载' },
    { id: 'stl-case', name: '外壳模型（STL）', kind: 'stl', url: '/course-resources/first-lesson/case.stl', note: '可选 3D 打印' },
  ],
  workbenchPath: '/workbench?course=first-lesson',
};

export function articleForSlug(slug: string): CourseArticle | null {
  if (slug === 'first-lesson' || slug === 'temp-buzzer' || slug === 'course-temp-buzzer') return FIRST_LESSON_ARTICLE;
  return null;
}

/** 旧块格式 → HTML（兼容后台已存的 chapters） */
function blocksToHtml(chapters: unknown): string {
  if (!Array.isArray(chapters)) return '';
  const parts: string[] = [];
  for (const ch of chapters as { title?: string; body?: string; blocks?: { type: string; text?: string; src?: string; caption?: string; tone?: string; images?: { src: string; caption?: string }[]; bvid?: string; videoTitle?: string }[] }[]) {
    if (ch.title) parts.push(`<h2>${escapeHtml(ch.title)}</h2>`);
    if (ch.blocks?.length) {
      for (const b of ch.blocks) {
        if (b.type === 'heading') parts.push(`<h3>${escapeHtml(b.text || '')}</h3>`);
        else if (b.type === 'paragraph') parts.push(`<p>${escapeHtml(b.text || '')}</p>`);
        else if (b.type === 'callout') {
          const tone = b.tone || 'tip';
          const tag = tone === 'warn' ? '注意' : tone === 'info' ? '提示' : '小贴士';
          parts.push(`<aside class="ca-callout ca-callout--${tone}" data-callout="${tone}"><span class="ca-callout__tag">${tag}</span><p>${escapeHtml(b.text || '')}</p></aside>`);
        } else if (b.type === 'image' && b.src) {
          parts.push(`<figure class="ca-figure"><img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.caption || '')}" /><figcaption>${escapeHtml(b.caption || '')}</figcaption></figure>`);
        } else if (b.type === 'gallery' && b.images?.length) {
          parts.push(`<div class="ca-gallery">${b.images.map((i) => `<figure class="ca-figure ca-figure--card"><img src="${escapeAttr(i.src)}" alt="${escapeAttr(i.caption || '')}" /><figcaption>${escapeHtml(i.caption || '')}</figcaption></figure>`).join('')}</div>`);
        } else if (b.type === 'bilibili' && b.bvid) {
          parts.push(`<div class="ca-bilibili" data-bilibili="${escapeAttr(b.bvid)}" data-title="${escapeAttr(b.videoTitle || '')}"><div class="ca-bilibili__ph"><strong>B 站视频</strong><span>${escapeHtml(b.videoTitle || b.bvid)}</span><code>bvid=${escapeHtml(b.bvid)}</code></div></div>`);
        }
      }
    } else if (ch.body) {
      parts.push(`<p>${escapeHtml(ch.body)}</p>`);
    }
  }
  return parts.join('\n');
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function normalizeArticle(raw: Partial<CourseArticle> & { slug: string }): CourseArticle {
  const base = articleForSlug(raw.slug) || FIRST_LESSON_ARTICLE;
  const docs = { ...base.docs };
  for (const t of ['low', 'mid', 'high'] as const) {
    if (raw.docs?.[t]) docs[t] = raw.docs[t];
    else if (raw.chapters && typeof raw.chapters === 'object' && (raw.chapters as Record<string, unknown>)[t]) {
      const html = blocksToHtml((raw.chapters as Record<string, unknown>)[t]);
      if (html) docs[t] = html;
    }
  }
  return {
    ...base,
    ...raw,
    subtitle: { ...base.subtitle, ...(raw.subtitle || {}) },
    docs,
    bilibili: { ...base.bilibili, ...(raw.bilibili || {}) },
    resources: raw.resources?.length ? raw.resources : base.resources,
    workbenchPath: raw.workbenchPath || `/workbench?course=${raw.courseId || raw.slug}`,
  };
}

/** 从 HTML 抽 h2 做目录 */
export function tocFromHtml(html: string): { id: string; title: string }[] {
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const out: { id: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html))) {
    const title = m[1].replace(/<[^>]+>/g, '').trim();
    if (!title) continue;
    out.push({ id: `h2-${i++}`, title });
  }
  return out;
}

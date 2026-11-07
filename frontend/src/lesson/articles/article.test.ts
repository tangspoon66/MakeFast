import { describe, expect, it } from 'vitest';
import { FIRST_LESSON_ARTICLE, normalizeArticle, tocFromHtml } from './firstLessonArticle';

describe('first lesson HTML article', () => {
  it('三档 docs 都含 boards/components 真图与 callout', () => {
    for (const tier of ['low', 'mid', 'high'] as const) {
      const html = FIRST_LESSON_ARTICLE.docs[tier];
      expect(html).toContain('/boards/xiao-esp32-s3/');
      expect(html).toContain('/components/');
      expect(html).toMatch(/ca-callout/);
      expect(html).toMatch(/ca-gallery|ca-figure/);
      expect(tocFromHtml(html).length).toBeGreaterThan(1);
    }
  });

  it('normalizeArticle 保留 docs，并从旧 chapters 迁移', () => {
    const n = normalizeArticle({
      slug: 'first-lesson',
      title: '自定义',
      docs: { low: '<h2>X</h2><p>hi</p>', mid: '', high: '' },
    } as never);
    expect(n.title).toBe('自定义');
    expect(n.docs.low).toContain('<h2>X</h2>');
    expect(n.docs.mid.length).toBeGreaterThan(0);

    const fromBlocks = normalizeArticle({
      slug: 'first-lesson',
      chapters: {
        low: [{ title: '旧章', blocks: [{ type: 'paragraph', text: '旧正文' }] }],
        mid: [],
        high: [],
      },
    } as never);
    expect(fromBlocks.docs.low).toContain('旧章');
    expect(fromBlocks.docs.low).toContain('旧正文');
  });
});

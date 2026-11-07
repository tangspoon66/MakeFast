/**
 * 图文课文章节：渲染所见即所得 HTML；Agent IDLE（M7）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import DOMPurify from 'isomorphic-dompurify';
import { articleForSlug, normalizeArticle, tocFromHtml } from '../lesson/articles/firstLessonArticle';
import type { CourseArticle } from '../lesson/articles/types';
import { AGE_TIERS, effectiveTier, useAgeTier, type AgeTier } from '../lesson/ageTier';
import { AgeTierSelect } from '../components/AgeTierSelect';
import { CatalogIdleAgent } from '../components/catalog/CatalogIdleAgent';
import '../styles/course-article.css';

async function fetchPublishedArticle(slug: string): Promise<CourseArticle | null> {
  try {
    const r = await fetch(`/api/course-agent/courses/${encodeURIComponent(slug)}/article`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.article) return null;
    return normalizeArticle({ ...j.article, slug });
  } catch {
    return null;
  }
}

const PURIFY = {
  ADD_TAGS: ['figure', 'figcaption', 'aside', 'iframe'],
  ADD_ATTR: ['data-callout', 'data-bilibili', 'data-title', 'data-testid', 'target', 'rel', 'class', 'loading'],
};

export function CourseArticlePage() {
  const { slug = '' } = useParams();
  const fallback = articleForSlug(slug);
  const [article, setArticle] = useState<CourseArticle | null>(fallback);
  const [loading, setLoading] = useState(!!fallback);
  const chosen = useAgeTier((s) => s.tier);
  const tier = effectiveTier(chosen);
  const setTier = useAgeTier((s) => s.setTier);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    void fetchPublishedArticle(slug).then((remote) => {
      if (cancelled) return;
      setArticle(remote || articleForSlug(slug));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  const html = article?.docs?.[tier] || '';
  const safe = useMemo(() => DOMPurify.sanitize(html, PURIFY), [html]);
  const toc = useMemo(() => tocFromHtml(html), [html]);

  // 给 h2 注入 id 方便目录跳转
  const htmlWithIds = useMemo(() => {
    let i = 0;
    return safe.replace(/<h2(\s[^>]*)?>/gi, () => `<h2 id="h2-${i++}">`);
  }, [safe]);

  if (!loading && !article) return <Navigate to="/courses" replace />;
  if (!article) {
    return <div className="ca-page" data-page="course-article"><p className="ca-muted" style={{ padding: 40 }}>加载章节…</p></div>;
  }

  const resources = article.resources;

  return (
    <div className="ca-page" data-page="course-article" data-testid="course-article" data-slug={article.slug}>
      <header className="ca-top">
        <Link to="/courses" className="ca-back">← 课程目录</Link>
        <Link to="/home" className="ca-brand">MakeFast</Link>
        <AgeTierSelect compact />
      </header>

      {article.cover && (
        <div className="ca-cover" data-testid="article-cover">
          <img src={article.cover} alt="" />
          <div className="ca-cover__txt">
            <p className="ca-kicker">课文章节 · 图文</p>
            <h1>{article.title}</h1>
            <p className="ca-sub" data-testid="article-subtitle">{article.subtitle[tier]}</p>
          </div>
        </div>
      )}

      <div className="ca-layout">
        <nav className="ca-toc" aria-label="章节目录">
          <p className="ca-toc__label">本章</p>
          <ol>
            {toc.map((c, i) => (
              <li key={c.id}>
                <button type="button" onClick={() => document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <span>{i + 1}</span>{c.title}
                </button>
              </li>
            ))}
          </ol>
          {!chosen && (
            <div className="ca-tier-pick" data-testid="article-age-chooser">
              <span>用哪种说法？</span>
              <div>{AGE_TIERS.map((t) => (
                <button key={t.id} type="button" className="lw-btn lw-btn--sm" onClick={() => setTier(t.id as AgeTier)} data-testid={`article-tier-${t.id}`}>
                  {t.emoji} {t.label}
                </button>
              ))}</div>
            </div>
          )}
        </nav>

        <main className="ca-main">
          {!article.cover && (
            <header className="ca-hero">
              <p className="ca-kicker">课文章节 · 图文</p>
              <h1>{article.title}</h1>
              <p className="ca-sub" data-testid="article-subtitle">{article.subtitle[tier]}</p>
            </header>
          )}

          <article
            className="ca-prose"
            data-testid="article-prose"
            dangerouslySetInnerHTML={{ __html: htmlWithIds }}
          />

          <section className="ca-resources" aria-label="课程资料" data-testid="article-resources">
            <h2>资料下载</h2>
            <ul>
              {resources.map((r) => (
                <li key={r.id}>
                  <span className="ca-res-kind">{r.kind.toUpperCase()}</span>
                  <a href={r.url} download={r.kind !== 'link' ? true : undefined} target="_blank" rel="noreferrer">{r.name}</a>
                  {r.note && <small>{r.note}</small>}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      <div className="ca-sticky" data-testid="article-start-create">
        <div>
          <strong>准备好动手了？</strong>
          <span>小铁猫会在工作台一步步带你。</span>
        </div>
        <Link className="ca-cta" to={article.workbenchPath} data-cta="start-create">开始创作</Link>
      </div>

      <CatalogIdleAgent surface="detail" />
    </div>
  );
}

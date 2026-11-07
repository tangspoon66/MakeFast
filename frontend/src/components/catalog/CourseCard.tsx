import type { CatalogCourse } from '../../catalog/courseCatalog';
import { StarRating } from './StarRating';

interface CourseCardProps {
  course: CatalogCourse;
  starting?: boolean;
  error?: string | null;
  onStart: (course: CatalogCourse) => void;
}

/** C-CAT-CARD — six fields + CTA「开始课程」; optional「开始这里」 */
export function CourseCard({ course, starting = false, error = null, onStart }: CourseCardProps) {
  return (
    <article
      className="group flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
      data-course-id={course.id}
      data-start-here={course.startHere ? 'true' : undefined}
    >
      <div className={`relative aspect-[16/10] ${course.coverUrl ? 'bg-white' : 'bg-gradient-to-br from-[#EAF5FD] to-[#C0E2F9]'}`}>
        {course.coverUrl ? (
          <img
            src={course.coverUrl}
            alt=""
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
            <span className="text-4xl" aria-hidden>{course.coverEmoji}</span>
                      </div>
        )}
        {course.startHere && (
          <span className="absolute right-3 top-3 rounded-lg bg-[#F4C65C] px-2.5 py-1 text-xs font-semibold text-[#1A2B3C] shadow-sm">
            开始这里
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h2 className="line-clamp-2 text-base font-bold leading-snug text-slate-800">
          {course.title}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <StarRating stars={course.difficultyStars} />
          <span className="rounded-md bg-[#C0E2F9] px-2 py-0.5 text-xs font-semibold text-[#1e5f8a]">
            {course.levelLabel}
          </span>
          {course.boardTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-[#74B0E1]/40 bg-white px-2 py-0.5 text-xs font-medium text-[#2a6ea0]"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="text-xs text-slate-500">分类：{course.category}</p>

        <button
          type="button"
          className="mt-auto h-11 w-full rounded-2xl bg-[#74B0E1] text-sm font-bold text-white transition hover:brightness-95 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          disabled={starting || course.comingSoon}
          title={course.comingSoon ? '老师已发布，课程内容即将开放' : undefined}
          onClick={() => onStart(course)}
          data-cta="start-course"
        >
          {course.comingSoon ? '即将开放' : starting ? '正在打开…' : '开始课程'}
        </button>
        {error && (
          <p className="text-xs text-red-600" role="alert">{error}</p>
        )}
      </div>
    </article>
  );
}

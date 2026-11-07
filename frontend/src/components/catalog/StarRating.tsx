/** C-STAR — read-only star difficulty */

interface StarRatingProps {
  stars: number;
  max?: number;
}

export function StarRating({ stars, max = 3 }: StarRatingProps) {
  const filled = Math.max(0, Math.min(stars, max));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`难度 ${filled} 星，共 ${max} 星`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`text-sm ${i < filled ? 'text-[#F4C65C]' : 'text-slate-300'}`}
          aria-hidden
        >
          ★
        </span>
      ))}
    </span>
  );
}

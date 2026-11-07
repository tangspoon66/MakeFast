import type { CatalogFilterId } from '../../catalog/courseCatalog';
import { CATALOG_FILTERS } from '../../catalog/courseCatalog';

interface CatalogFilterProps {
  value: CatalogFilterId;
  onChange: (next: CatalogFilterId) => void;
}

/** C-CAT-FILTER — default「入门教程」 */
export function CatalogFilter({ value, onChange }: CatalogFilterProps) {
  return (
    <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="课程筛选">
      {CATALOG_FILTERS.map((filter) => {
        const selected = value === filter;
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(filter)}
            className={
              selected
                ? 'rounded-full bg-[#74B0E1] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95'
                : 'rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-[#74B0E1]/60 hover:text-slate-800'
            }
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}

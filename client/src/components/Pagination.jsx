function ChevronLeft({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const navBtn =
  'inline-flex items-center justify-center gap-1.5 min-h-10 min-w-[6.5rem] px-3 py-2 text-sm font-semibold rounded-lg border-2 border-gray-400 bg-white text-primary shadow-sm hover:bg-slate-50 hover:border-primary/60 hover:shadow transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:shadow-none';

const pageBtnBase =
  'inline-flex min-h-10 min-w-10 items-center justify-center px-2 text-sm font-bold rounded-lg border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1';

const pageBtnActive = 'border-accent bg-accent text-white shadow-md';
const pageBtnInactive = 'border-gray-400 bg-white text-gray-800 hover:bg-slate-50 hover:border-primary/50';

/** Max page buttons before switching to 1 … window … last pattern */
const SHOW_ALL_THRESHOLD = 9;
/** Pages to show on each side of the current page in the middle window */
const PAGE_WINDOW = 2;

/**
 * @returns {({ type: 'page', value: number } | { type: 'ellipsis', key: string })[]}
 */
function getVisiblePageItems(currentPage, totalPages) {
  if (totalPages <= SHOW_ALL_THRESHOLD) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: 'page', value: i + 1 }));
  }

  const set = new Set([1, totalPages]);
  for (let i = currentPage - PAGE_WINDOW; i <= currentPage + PAGE_WINDOW; i += 1) {
    if (i >= 1 && i <= totalPages) set.add(i);
  }

  const sorted = [...set].sort((a, b) => a - b);
  /** @type {({ type: 'page', value: number } | { type: 'ellipsis', key: string })[]} */
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push({ type: 'ellipsis', key: `gap-${sorted[i - 1]}-${sorted[i]}` });
    }
    out.push({ type: 'page', value: sorted[i] });
  }
  return out;
}

/**
 * @param {{ page: number; total: number; pageSize: number; onChange: (p: number) => void; showSummary?: boolean; className?: string }} props
 */
export default function Pagination({ page, total, pageSize, onChange, showSummary = false, className = '' }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageItems = getVisiblePageItems(page, totalPages);

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={navBtn}
        aria-label="Previous page"
      >
        <ChevronLeft />
        <span>Prev</span>
      </button>
      {pageItems.map((item) =>
        item.type === 'ellipsis' ? (
          <span
            key={item.key}
            className="inline-flex min-h-10 min-w-10 items-center justify-center px-1 text-lg font-bold leading-none text-gray-400 select-none"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={`page-${item.value}`}
            type="button"
            onClick={() => onChange(item.value)}
            className={`${pageBtnBase} ${item.value === page ? pageBtnActive : pageBtnInactive}`}
            aria-label={`Page ${item.value}`}
            aria-current={item.value === page ? 'page' : undefined}
          >
            {item.value}
          </button>
        ))}
      <button
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={navBtn}
        aria-label="Next page"
      >
        <span>Next</span>
        <ChevronRight />
      </button>
    </div>
  );

  if (showSummary) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 mt-2 ${className}`}>
        <p className="text-sm font-medium text-gray-600 tabular-nums">
          Showing <span className="text-primary font-bold">{from}</span>
          –
          <span className="text-primary font-bold">{to}</span>
          {' '}
          of <span className="text-primary font-bold">{total}</span>
        </p>
        {controls}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 pt-3 px-1 ${className}`}>
      {controls}
    </div>
  );
}

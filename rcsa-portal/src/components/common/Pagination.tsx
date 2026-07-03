import { useEffect, useState } from 'react';

const PAGE_SIZES = [10, 25, 50, 100];

/**
 * Client-side pagination for catalogue tables — keeps page height bounded no
 * matter how many rows. Resets to page 1 whenever the data set or page size
 * changes (e.g. after filtering).
 */
export function usePaged<T>(items: T[], initialSize = 25) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => { setPage(1); }, [items.length, pageSize]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { page: safePage, setPage, pageSize, setPageSize, pageCount, total: items.length, start, pageItems };
}

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  start: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}

export function Pagination({ page, pageCount, pageSize, total, start, onPage, onPageSize }: PaginationProps) {
  if (total === 0) return null;
  const from = start + 1;
  const to = Math.min(start + pageSize, total);
  const btn = 'btn-neutral border rounded px-2.5 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t bg-gray-50 text-sm">
      <span className="text-gray-500 text-xs">Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500 flex items-center gap-1">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="border rounded px-1.5 py-1 text-sm bg-white"
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn}>← Prev</button>
          <span className="text-xs text-gray-500">Page {page} / {pageCount}</span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} className={btn}>Next →</button>
        </div>
      </div>
    </div>
  );
}

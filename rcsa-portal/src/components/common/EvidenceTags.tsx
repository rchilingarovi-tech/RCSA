/** Removable evidence filename tags — ported from renderEvidenceTags (New Version.html L848). */
export function EvidenceTags({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  return (
    <>
      {items.map((e, i) => (
        <span key={`${e}-${i}`} className="badge bg-gray-200 text-gray-700 inline-flex items-center gap-1">
          {e}{' '}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${e}`}
            className="text-gray-500 hover:text-red-600 font-bold leading-none"
          >
            ×
          </button>
        </span>
      ))}
    </>
  );
}

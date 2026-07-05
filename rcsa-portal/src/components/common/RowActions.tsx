// Shared table row-action buttons — pencil (edit) + trash (delete) icons with
// tooltips, replacing the old "Edit" / "Delete" text links for a friendlier UI.
// Pass only the handlers the current user is allowed to use; renders "—" when
// neither is available.

const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></svg>
);

const btn = 'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors';

export function RowActions({
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  if (!onEdit && !onDelete) return <span style={{ color: 'var(--text3)' }}>—</span>;
  return (
    <div className="flex gap-2">
      {onEdit && (
        <button type="button" title={editLabel} aria-label={editLabel} onClick={onEdit} className={`${btn} text-gray-400 hover:text-blue-600 hover:border-blue-300`} style={{ borderColor: 'var(--border)' }}>
          <PencilIcon />
        </button>
      )}
      {onDelete && (
        <button type="button" title={deleteLabel} aria-label={deleteLabel} onClick={onDelete} className={`${btn} text-gray-400 hover:text-red-500 hover:border-red-300`} style={{ borderColor: 'var(--border)' }}>
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

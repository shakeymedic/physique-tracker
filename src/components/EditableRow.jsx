/**
 * EditableRow — reusable row with Edit (pencil) and Delete (trash) actions.
 *
 * Props:
 *   onEdit: () => void
 *   onDelete: () => void
 *   children: React node (row content)
 *   className: additional classes
 */
import { Pencil, Trash2 } from 'lucide-react'

export default function EditableRow({ onEdit, onDelete, children, className = '' }) {
  return (
    <div className={`flex items-center justify-between bg-bg rounded-lg px-3 py-2 gap-2 ${className}`}>
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onEdit && (
          <button
            onClick={onEdit}
            className="btn-ghost p-1.5 text-muted hover:text-accent"
            title="Edit"
          >
            <Pencil size={13}/>
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="btn-ghost p-1.5 text-muted hover:text-danger"
            title="Delete"
          >
            <Trash2 size={13}/>
          </button>
        )}
      </div>
    </div>
  )
}

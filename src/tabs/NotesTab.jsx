import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import '../TabShared.css'
import './NotesTab.css'

const DEFAULT_SECTIONS = ['Backstory', 'Session Notes', 'NPCs', 'Party Notes']

function DeleteModal({ name, onConfirm, onCancel }) {
  return createPortal(
    <div className="notes-modal-overlay" onClick={onCancel}>
      <div className="notes-modal" onClick={e => e.stopPropagation()}>
        <div className="notes-modal-title">Delete "{name}"?</div>
        <p className="notes-modal-body">
          This will permanently delete this section and all its notes. This cannot be undone.
        </p>
        <div className="notes-modal-actions">
          <button className="notes-modal-btn notes-modal-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="notes-modal-btn notes-modal-btn--danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function NoteSection({ name, isDefault, isOwner, locked, collapsed, text, onToggle, onText, onRename, onDelete }) {
  const [focused, setFocused] = useState(false)
  const [localName, setLocalName] = useState(name)
  const taRef = useRef(null)

  // Auto-grow textarea
  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = Math.max(100, taRef.current.scrollHeight) + 'px'
    }
  }, [text, collapsed])

  const canEdit = isOwner && !locked

  return (
    <div className={`note-section${collapsed ? ' note-section--collapsed' : ''}`}>
      <div className="note-section-head" onClick={onToggle}>
        {isDefault
          ? <span className="note-lock" title="Default section">🔒</span>
          : canEdit && <button className="note-delete-btn" onClick={e => { e.stopPropagation(); onDelete() }} title="Delete section">✕</button>
        }

        {!isDefault && canEdit ? (
          <input
            className="note-name-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={() => onRename(localName)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="note-name">{name}</span>
        )}

        <span className={`note-chevron${collapsed ? ' note-chevron--closed' : ''}`}>▾</span>
      </div>

      {!collapsed && (
        <div className="note-body">
          {canEdit ? (
            <>
              <textarea
                ref={taRef}
                className={`note-ta${focused ? ' note-ta--focused' : ''}`}
                value={text ?? ''}
                onChange={e => onText(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={`${name}…`}
                spellCheck
              />
              {focused && (
                <div className="note-charcount">{(text ?? '').length} chars</div>
              )}
            </>
          ) : (
            <div className="note-readonly">
              {text
                ? text.split('\n').map((line, i) => <p key={i}>{line || <br />}</p>)
                : <p className="empty-hint">No notes yet.</p>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function NotesTab({ char, locked, isOwner, updateChar }) {
  const notes    = char.notes ?? {}
  const customs  = char.notesSections ?? []   // [{id, name}]
  const collapsed = char.notesCollapsed ?? {} // {sectionName: true}
  const [deleteTarget, setDeleteTarget] = useState(null)

  const setCollapsed = (name, val) =>
    updateChar({ notesCollapsed: { ...collapsed, [name]: val } })

  const setText = (name, val) =>
    updateChar({ notes: { ...notes, [name]: val } })

  const renameCustom = (id, newName) => {
    updateChar({
      notesSections: customs.map(s => s.id === id ? { ...s, name: newName } : s),
      notes: {
        ...notes,
        [newName]: notes[id] ?? '',
        [id]: undefined,
      },
    })
  }

  const addSection = () => {
    const id   = `custom-${Date.now()}`
    const name = 'New Section'
    updateChar({
      notesSections: [...customs, { id, name }],
    })
  }

  const deleteSection = (id) => {
    const { [id]: _removed, ...rest } = notes
    updateChar({
      notesSections: customs.filter(s => s.id !== id),
      notes: rest,
    })
    setDeleteTarget(null)
  }

  return (
    <div className="notes-root">
      <div className="notes-scroll">

        {/* Default sections */}
        {DEFAULT_SECTIONS.map(name => (
          <NoteSection
            key={name}
            name={name}
            isDefault
            isOwner={isOwner}
            locked={locked}
            collapsed={!!collapsed[name]}
            text={notes[name]}
            onToggle={() => setCollapsed(name, !collapsed[name])}
            onText={val => setText(name, val)}
            onRename={() => {}}
            onDelete={() => {}}
          />
        ))}

        {/* Custom sections */}
        {customs.map(section => (
          <NoteSection
            key={section.id}
            name={section.name}
            isDefault={false}
            isOwner={isOwner}
            locked={locked}
            collapsed={!!collapsed[section.id]}
            text={notes[section.id] ?? notes[section.name]}
            onToggle={() => setCollapsed(section.id, !collapsed[section.id])}
            onText={val => setText(section.id, val)}
            onRename={newName => renameCustom(section.id, newName)}
            onDelete={() => setDeleteTarget(section)}
          />
        ))}

        {/* Add section */}
        {isOwner && !locked && (
          <button className="note-add-section" onClick={addSection}>
            + Add section
          </button>
        )}
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={() => deleteSection(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

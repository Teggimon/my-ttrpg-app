import { useState } from 'react'
import '../TabShared.css'
import './NotesTab.css'

const DEFAULT_SECTIONS = ['Backstory', 'Session notes', 'NPCs', 'Party notes']

export default function NotesTab({ char, locked, isOwner, updateChar }) {
  const notes = char.notes ?? {}
  const sections = char.notesSections ?? DEFAULT_SECTIONS
  const [activeSection, setActiveSection] = useState(sections[0] ?? 'Notes')

  function updateNote(section, value) {
    updateChar({ notes: { ...notes, [section]: value } })
  }

  return (
    <div className="notes-tab">
      <div className="notes-sections">
        {sections.map(s => (
          <button
            key={s}
            className={`notes-section-btn ${activeSection === s ? 'notes-section-btn--active' : ''}`}
            onClick={() => setActiveSection(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {isOwner && !locked ? (
        <textarea
          className="notes-textarea"
          value={notes[activeSection] ?? ''}
          onChange={e => updateNote(activeSection, e.target.value)}
          placeholder={`${activeSection}…`}
          spellCheck
        />
      ) : (
        <div className="notes-readonly">
          {notes[activeSection]
            ? notes[activeSection].split('\n').map((line, i) => (
                <p key={i}>{line || <br />}</p>
              ))
            : <p className="empty-hint">No notes yet.</p>
          }
        </div>
      )}
    </div>
  )
}

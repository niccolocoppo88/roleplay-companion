import React, { useState, useEffect, useRef } from 'react';
import { toast } from './Toast';

// Simple markdown renderer (bold, italic, lists, headers)
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/^### (.*)$/gm, '<h3 class="text-sm font-semibold text-text-primary mt-2 mb-1">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="text-base font-semibold text-text-primary mt-3 mb-1">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="text-lg font-bold text-text-primary mt-3 mb-2">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-text-primary">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-text-secondary">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-bg-tertiary px-1 rounded text-accent-primary text-xs">$1</code>')
    .replace(/^- (.*)$/gm, '<li class="ml-4 text-sm text-text-secondary">• $1</li>')
    .replace(/^(\d+)\. (.*)$/gm, '<li class="ml-4 text-sm text-text-secondary">$1. $2</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-text-secondary mb-2">')
    .replace(/\n/g, '<br/>');
  return `<p class="text-sm text-text-secondary mb-2">${html}</p>`;
}

export default function NotesPanel({ campaignId, sessionId = null }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && campaignId) {
      loadNotes();
    }
  }, [open, campaignId]);

  async function loadNotes() {
    setLoading(true);
    try {
      // Load from campaign notes
      const campRes = await window.db.campaigns.get(campaignId);
      if (campRes.ok && campRes.data?.campaign_notes) {
        try {
          setNotes(JSON.parse(campRes.data.campaign_notes));
        } catch { setNotes([]); }
      } else {
        setNotes([]);
      }
    } catch { setNotes([]); }
    setLoading(false);
  }

  async function saveNotes(updatedNotes) {
    setNotes(updatedNotes);
    try {
      await window.db.campaigns.update({ 
        id: campaignId, 
        campaign_notes: JSON.stringify(updatedNotes) 
      });
    } catch { toast('Errore nel salvare le note', 'error'); }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    const note = {
      id: `note-${Date.now()}`,
      text: newNote.trim(),
      created_at: new Date().toISOString(),
      session_id: sessionId,
    };
    const updated = [note, ...notes];
    await saveNotes(updated);
    setNewNote('');
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast('Nota aggiunta!', 'success');
  }

  async function handleDeleteNote(id) {
    const updated = notes.filter(n => n.id !== id);
    await saveNotes(updated);
  }

  async function handleSaveEdit() {
    if (!editText.trim()) return;
    const updated = notes.map(n => 
      n.id === editingId ? { ...n, text: editText.trim() } : n
    );
    await saveNotes(updated);
    setEditingId(null);
    setEditText('');
    toast('Nota aggiornata!', 'success');
  }

  function startEdit(note) {
    setEditingId(note.id);
    setEditText(note.text);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
      });
    } catch { return ''; }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed right-4 bottom-20 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open 
            ? 'bg-accent-primary text-bg-primary rotate-0' 
            : 'bg-bg-secondary text-text-primary border border-border-primary hover:border-accent-primary'
        }`}
        title="Note rapide"
      >
        📝
      </button>

      {/* Sidebar */}
      <div className={`fixed right-0 top-0 h-full w-80 bg-bg-secondary border-l border-border-primary z-50 transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h3 className="font-semibold text-text-primary flex items-center gap-2">
            📝 Note Rapide
          </h3>
          <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary text-xl">
            ×
          </button>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {loading ? (
            <p className="text-text-muted text-sm text-center py-8">Caricamento...</p>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-muted text-sm">Nessuna nota ancora</p>
              <p className="text-text-muted text-xs mt-1">Scrivi qualcosa per iniziare</p>
            </div>
          ) : (
            notes.map(note => (
              <div key={note.id} className="bg-bg-tertiary rounded-lg p-3 border border-border-subtle group">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      className="input text-sm resize-none w-full"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveEdit}
                        className="text-xs text-accent-success hover:underline"
                      >
                        💾 Salva
                      </button>
                      <button 
                        onClick={() => { setEditingId(null); setEditText(''); }}
                        className="text-xs text-text-muted hover:underline"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="text-sm text-text-secondary whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(note.text) }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-text-muted">{formatDate(note.created_at)}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEdit(note)}
                          className="text-xs text-text-muted hover:text-accent-primary"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-xs text-text-muted hover:text-accent-danger"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* New note input */}
        <div className="p-3 border-t border-border-primary">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Scrivi una nota... (supporta **bold** *italic* # headers)"
            rows={2}
            className="input text-sm resize-none w-full"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleAddNote();
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-muted">⌘+Enter per salvare</span>
            <button 
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="btn btn-primary text-sm"
            >
              Aggiungi
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop when open */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/30 z-40" 
          onClick={() => setOpen(false)} 
        />
      )}
    </>
  );
}
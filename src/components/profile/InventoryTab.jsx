import React, { useState, useRef } from 'react';

const TYPE_COLORS = {
  arma: 'border-accent-warning text-accent-warning',
  armatura: 'border-blue-400 text-blue-400',
  consumabile: 'border-accent-success text-accent-success',
  incantesimo: 'border-purple-400 text-purple-400',
  strumento: 'border-text-muted text-text-muted',
};

const SLOT_LABELS = {
  mainHand: 'Mano Principale',
  offHand: 'Scudo/Mano Secondaria',
  torso: 'Torso',
  head: 'Testa',
  ring: 'Anello',
  feet: 'Piedi',
  default: 'Nessuno',
};

// Drag-drop reordering for inventory items
function DraggableItem({ item, index, onDragStart, onDragOver, onDrop, onToggleEquip, onRemove }) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = (e) => {
    setIsDragging(true);
    onDragStart(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(index);
  };
  
  return (
    <tr
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={() => onDrop(index)}
      className={`
        border-b border-border-primary hover:bg-bg-tertiary transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? 'opacity-50 bg-accent-primary/10' : ''}
        ${item.equipped ? 'bg-accent-success/5' : ''}
      `}
    >
      {/* Drag handle */}
      <td className="px-3 py-3 text-center">
        <span className="text-text-muted hover:text-text-secondary cursor-grab">⋮⋮</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`w-1 h-6 rounded-full ${TYPE_COLORS[item.type]?.split(' ')[0] || 'bg-border-primary'}`} />
          <span className="text-text-primary font-medium">{item.name}</span>
          {item.equipped && <span className="text-accent-success text-xs">✓</span>}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[item.type] || 'border-border-primary text-text-muted'}`}>
          {item.type}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-text-secondary">{item.quantity}</td>
      <td className="px-3 py-3 text-center text-text-secondary">{item.weight} lb</td>
      <td className="px-3 py-3 text-center text-muted text-xs">
        {item.equipped ? SLOT_LABELS[item.slot] || SLOT_LABELS.default : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onToggleEquip(item.id)}
          className={`
            w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center mx-auto
            ${item.equipped 
              ? 'border-accent-success bg-accent-success/20 text-accent-success' 
              : 'border-border-primary text-text-muted hover:border-accent-success hover:text-accent-success'
            }
          `}
          title={item.equipped ? 'Rimuovi equipaggiamento' : 'Equipaggia'}
        >
          {item.equipped ? '✓' : '+'}
        </button>
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onRemove(item.id)}
          className="text-text-muted hover:text-accent-danger transition-colors"
          title="Rimuovi"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export default function InventoryTab({ inventory = [], onInventoryChange }) {
  const [filter, setFilter] = useState('all');
  const [showEquippedOnly, setShowEquippedOnly] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [items, setItems] = useState(inventory);

  // Handle inventory updates from parent
  React.useEffect(() => {
    if (inventory !== items) {
      setItems(inventory);
    }
  }, [inventory]);

  const filtered = items.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false;
    if (showEquippedOnly && !item.equipped) return false;
    return true;
  });

  const totalWeight = items.reduce((sum, item) => sum + (item.weight * item.quantity), 0).toFixed(1);
  const equippedWeight = items.filter(i => i.equipped).reduce((sum, item) => sum + item.weight * item.quantity, 0).toFixed(1);

  // Drag-drop handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index) => {
    if (draggedIndex === null || draggedIndex === index) return;
  };

  const handleDrop = (dropIndex) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, removed);
    
    setItems(newItems);
    setDraggedIndex(null);
    
    // Notify parent of reorder
    onInventoryChange?.(newItems);
  };

  const handleToggleEquip = (itemId) => {
    const newItems = items.map(item => 
      item.id === itemId ? { ...item, equipped: !item.equipped } : item
    );
    setItems(newItems);
    onInventoryChange?.(newItems);
  };

  const handleRemove = (itemId) => {
    const newItems = items.filter(item => item.id !== itemId);
    setItems(newItems);
    onInventoryChange?.(newItems);
  };

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {['all', 'arma', 'armatura', 'consumabile', 'strumento'].map(type => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filter === type
                    ? 'bg-accent-primary text-bg-primary border-accent-primary'
                    : 'border-border-primary text-text-muted hover:border-border-hover'
                }`}
              >
                {type === 'all' ? 'Tutti' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowEquippedOnly(!showEquippedOnly)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              showEquippedOnly
                ? 'bg-accent-primary text-bg-primary border-accent-primary'
                : 'border-border-primary text-text-muted hover:border-border-hover'
            }`}
          >
            Solo Equipaggiati
          </button>
        </div>
        <div className="text-sm text-text-muted">
          <span className="font-medium text-text-secondary">{items.length}</span> oggetti •
          <span className="font-medium text-text-secondary ml-1">{totalWeight}</span> lb totali
          ({equippedWeight} equipaggiati)
        </div>
      </div>

      {/* Drag hint */}
      <div className="flex items-center gap-2 mb-3 text-xs text-text-muted">
        <span>⋮⋮</span>
        <span>Trascina per riordinare gli oggetti</span>
      </div>

      {/* Inventory table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary bg-bg-tertiary">
              <th className="w-10 text-left px-3 py-3"></th>
              <th className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Nome</th>
              <th className="text-center px-3 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Tipo</th>
              <th className="text-center px-3 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Qtà</th>
              <th className="text-center px-3 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Peso</th>
              <th className="text-center px-3 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Slot</th>
              <th className="text-center px-4 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold">Equip.</th>
              <th className="w-10 text-center px-4 py-3 text-xs text-text-muted uppercase tracking-wide font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, index) => (
              <DraggableItem
                key={item.id}
                item={item}
                index={index}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onToggleEquip={handleToggleEquip}
                onRemove={handleRemove}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🎒</div>
            <p className="text-text-muted">Nessun oggetto corrisponde ai filtri</p>
            <p className="text-text-muted text-xs mt-1">Gli oggetti verranno aggiunti automaticamente dopo le sessioni</p>
          </div>
        )}
      </div>
    </div>
  );
}
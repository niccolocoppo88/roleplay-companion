/**
 * useKeyboardShortcuts.js
 * Global keyboard shortcuts for the app
 * - Escape to close modals
 * - Cmd/Ctrl+N for new campaign
 * - Cmd/Ctrl+Shift+N for new character
 */
import { useEffect } from 'react';

export function useKeyboardShortcuts({ onNewCampaign, onNewCharacter, modalOpen }) {
  useEffect(() => {
    function handleKeyDown(e) {
      // Skip if user is typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      // Escape — close any open modal (handled by individual components)
      if (e.key === 'Escape' && modalOpen) {
        // Let the modal handle its own escape
        return;
      }

      // Cmd/Ctrl+N — new campaign
      if (modifier && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        onNewCampaign?.();
      }

      // Cmd/Ctrl+Shift+N — new character
      if (modifier && e.key === 'n' && e.shiftKey) {
        e.preventDefault();
        onNewCharacter?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewCampaign, onNewCharacter, modalOpen]);
}

export default function KeyboardShortcutProvider() {
  // This component can be used to provide shortcuts context
  return null;
}
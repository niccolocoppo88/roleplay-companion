import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

let toastId = 0;
let addToastFn = null;

export function toast(message, type = 'success', duration = 3000) {
  if (addToastFn) addToastFn({ id: ++toastId, message, type, duration });
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = (toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => removeToast(toast.id), toast.duration);
    };
    return () => { addToastFn = null; };
  }, [removeToast]);

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-item pointer-events-auto animate-slide-in-right ${
            t.type === 'success' ? 'toast-success' :
            t.type === 'error' ? 'toast-error' :
            'toast-info'
          }`}
        >
          <span className="mr-2">
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
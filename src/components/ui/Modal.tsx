'use client';

import { useEffect, useId, useRef } from 'react';

/**
 * Dialog shell used for the photo tour and "all amenities". Escape or backdrop
 * click closes it. `wide` gives it most of the screen, for photos.
 */
export function Modal({
  title,
  open,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`modal-box${wide ? ' modal-wide' : ''}`}>
        <div className="modal-top">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './overlays.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** The native modal supplies focus containment and an inert page underneath. */
export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (element && !element.open) element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`velocity-modal${wide ? ' velocity-modal--wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); closeRef.current(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeRef.current();
      }}
    >
      <div className="velocity-modal__header">
        <div><span className="ov-eyebrow">VELOCITY / MOTOR CO.</span><h2 id={titleId}>{title}</h2></div>
        <button className="ov-icon-button" onClick={onClose} aria-label="Close dialog" autoFocus><X size={23} /></button>
      </div>
      {children}
    </dialog>
  );
}

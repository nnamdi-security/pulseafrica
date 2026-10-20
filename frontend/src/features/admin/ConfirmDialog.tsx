'use client';

/* admin.html's confirmation dialog (decision 0026, D53): the native <dialog>, opened with
   showModal(), so the browser traps focus inside it and returns focus to the button that
   opened it. Every destructive admin action asks through it, and says what will happen. */
import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY } from './ui';

export type ConfirmOptions = {
  title: string;
  /** The consequence, in a sentence */
  text: string;
  /** The confirm button's label, e.g. "Delete poll" */
  confirm: string;
  /** false for a non-destructive change (reactivate, remove admin): a navy button, not red */
  danger?: boolean;
};

/** → [the dialog to render, confirm(options) → Promise<true if confirmed>] */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((yes: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== 'function') return Promise.resolve(window.confirm(`${next.title}\n\n${next.text}`));
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      dialog.returnValue = 'cancel';
      dialog.showModal();
      cancel.current?.focus();
    });
  }, []);

  const danger = options?.danger !== false;
  const element = (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-text"
      onClose={(e) => {
        resolver.current?.(e.currentTarget.returnValue === 'ok');
        resolver.current = null;
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-xl border-none p-6 shadow-[0_20px_60px] shadow-navy/30 backdrop:bg-navy/55"
    >
      <div>
        <h2 id="confirm-title" className="mb-2.5 font-serif text-[19px] font-semibold text-navy">
          {options?.title ?? 'Are you sure?'}
        </h2>
        <p id="confirm-text" className="mb-5 text-[13px] leading-[1.6] text-ink/80">
          {options?.text}
        </p>
        <div className="flex justify-end gap-2.5">
          {/* Cancel has the focus when the dialog opens, as on admin.html, so Enter never confirms by accident */}
          <button ref={cancel} type="button" onClick={() => ref.current?.close('cancel')} className={BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={() => ref.current?.close('ok')} className={cn(danger ? BUTTON_DANGER : BUTTON_PRIMARY)}>
            {options?.confirm ?? 'Confirm'}
          </button>
        </div>
      </div>
    </dialog>
  );

  return [element, confirm] as const;
}

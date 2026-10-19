import {t} from '../i18n/index.js';
import React, { useEffect, useRef } from 'react';
export function XPDialog({ title, onClose, children, alert = false }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    alert?: boolean;
}) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => { const prior = document.activeElement as HTMLElement | null; ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => { if (prior?.isConnected)
        prior.focus(); }; }, []);
    return <div className="dialog-backdrop archive-dialog-backdrop"><section ref={ref} className="xp-dialog" role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={title} onKeyDown={e => { if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    } if (e.key === 'Tab') {
        const items = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')];
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
        }
    } }}><div className="titlebar"><span>{title}</span><button className="dialog-close" onClick={onClose} aria-label={t("关闭弹窗")}>×</button></div>{children}</section></div>;
}

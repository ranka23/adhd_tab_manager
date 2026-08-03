/**
 * DonateCard component — the last section on the Home tab.
 *
 * ADHD Tab Manager is free and open source. This card invites users to
 * support development with a small donation. It opens a donation modal with
 * preset amounts; the "Donate" action opens the configured donation page in a
 * new tab, and the footer links to the open-source repository.
 *
 * The modal follows the same a11y pattern as the window picker: focus moves
 * into the dialog, Escape closes it, and Tab is trapped inside until dismiss.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DONATION_AMOUNTS, DONATION_URL, SOURCE_URL } from '../../shared/constants';
import { browser } from '../../shared/browser';

/** Renders the donate card + modal. */
export const DonateCard: React.FC = () => {
  /** Whether the donation modal is open */
  const [modalOpen, setModalOpen] = useState(false);
  /** Currently selected amount (USD) */
  const [amount, setAmount] = useState<number>(5);
  /** Ref for the modal dialog (focus + Escape handling) */
  const dialogRef = useRef<HTMLDivElement | null>(null);

  /** Builds the donation URL with the selected amount where supported. */
  const buildDonationUrl = (): string => {
    try {
      const url = new URL(DONATION_URL);
      // Common query keys: ko-fi `amount`, Buy Me a Coffee `amount`, GitHub
      // Sponsors ignores it. Only append when the host is one of the known
      // amount-aware providers so we never corrupt a custom link.
      const knownAmountHosts = ['ko-fi.com', 'www.ko-fi.com', 'buymeacoffee.com', 'www.buymeacoffee.com'];
      if (knownAmountHosts.includes(url.hostname)) {
        url.searchParams.set('amount', String(amount));
      }
      return url.toString();
    } catch {
      return DONATION_URL;
    }
  };

  /** Opens the donation page in a new tab and closes the modal. */
  const handleDonate = (): void => {
    void browser.tabs.create({ url: buildDonationUrl() });
    setModalOpen(false);
  };

  /** Escape + focus management for the modal (same pattern as the picker). */
  useEffect(() => {
    if (!modalOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('.donate-dialog__cta');
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
        );
        if (focusable.length === 0) return;
        const firstEl = focusable[0]!;
        const lastEl = focusable[focusable.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [modalOpen]);

  return (
    <div className="donate-card">
      <div className="donate-card__header">
        <span className="donate-card__icon" role="img" aria-label="heart">
          💜
        </span>
        <div className="donate-card__text">
          <h3 className="donate-card__title">Support the Project</h3>
          <p className="donate-card__subtitle">Free forever. Open source. Your support keeps it focused.</p>
        </div>
      </div>
      <button className="btn btn-primary donate-card__button" onClick={() => setModalOpen(true)}>
        ☕ Buy me a coffee
      </button>

      {/* Donation modal */}
      {modalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Donate to ADHD Tab Manager"
        >
          <div
            className="confirm-dialog donate-dialog"
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            {/* Hero asset */}
            <div className="donate-dialog__hero" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="56" height="56" focusable="false">
                <defs>
                  <linearGradient id="donate-heart" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#f472b6" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
                <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#donate-heart)" opacity="0.16" />
                <path
                  d="M32 46.5s-13.5-8.2-13.5-17.2c0-4.6 3.4-7.8 7.6-7.8 2.6 0 4.7 1.3 5.9 3.3 1.2-2 3.3-3.3 5.9-3.3 4.2 0 7.6 3.2 7.6 7.8 0 9-13.5 17.2-13.5 17.2Z"
                  fill="url(#donate-heart)"
                />
              </svg>
            </div>

            <div className="confirm-dialog__body">
              <p className="donate-dialog__title">Support ADHD Tab Manager</p>
              <p className="donate-dialog__message">
                ADHD Tab Manager is free and open source. If it helps you stay focused, consider a
                small donation to support development. 💜
              </p>

              {/* Amount presets */}
              <div className="donate-dialog__amounts" role="group" aria-label="Donation amount">
                {DONATION_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    className={`donate-dialog__amount ${amount === value ? 'donate-dialog__amount--selected' : ''}`}
                    onClick={() => setAmount(value)}
                    aria-pressed={amount === value}
                  >
                    ${value}
                  </button>
                ))}
              </div>
              <p className="confirm-dialog__hint">
                Opens {buildDonationUrl().split('?')[0]} with ${amount} in a new tab.
              </p>
            </div>

            <div className="confirm-dialog__actions donate-dialog__actions">
              <button className="btn btn-text" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary donate-dialog__cta" onClick={handleDonate}>
                Donate ${amount}
              </button>
            </div>

            <div className="donate-dialog__footer">
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                View source on GitHub
              </a>
              <span className="donate-dialog__opensource">· open source</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

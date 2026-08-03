/**
 * DonateCard component — the last section on the Home tab.
 *
 * ADHD Tab Manager is free and open source. This card invites users to
 * support development with a small donation. It opens a donation modal with
 * the SideRouter donation implementation: crypto wallet addresses (ETH + SOL)
 * with their QR-code images and one-tap copy buttons, plus an open-source
 * footer link. USDC/USDT are sent to the Ethereum address.
 *
 * The modal follows the same a11y pattern as the window picker: focus moves
 * into the dialog, Escape closes it, and Tab is trapped inside until dismiss.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  DONATION_ETH_ADDRESS,
  DONATION_QR_ETH,
  DONATION_QR_SOL,
  DONATION_SOL_ADDRESS,
  SOURCE_URL,
} from '../../shared/constants';
import { browser } from '../../shared/browser';

/** A single wallet entry rendered in the donate modal. */
interface WalletOption {
  id: 'eth' | 'sol';
  icon: string;
  name: string;
  address: string;
  qrPath: string;
  qrAlt: string;
  copyLabel: string;
  copiedLabel: string;
}

const WALLETS: WalletOption[] = [
  {
    id: 'eth',
    icon: '🔷',
    name: 'ETH',
    address: DONATION_ETH_ADDRESS,
    qrPath: DONATION_QR_ETH,
    qrAlt: 'Ethereum wallet QR code',
    copyLabel: 'Copy Ethereum address',
    copiedLabel: '✓ Copied',
  },
  {
    id: 'sol',
    icon: '🟣',
    name: 'SOL',
    address: DONATION_SOL_ADDRESS,
    qrPath: DONATION_QR_SOL,
    qrAlt: 'Solana wallet QR code',
    copyLabel: 'Copy Solana address',
    copiedLabel: '✓ Copied',
  },
];

/** Renders the donate card + modal. */
export const DonateCard: React.FC = () => {
  /** Whether the donation modal is open */
  const [modalOpen, setModalOpen] = useState(false);
  /** Wallet id currently showing "copied" feedback ('' = none) */
  const [copied, setCopied] = useState<WalletOption['id'] | ''>('');
  /** Ref for the modal dialog (focus + Escape handling) */
  const dialogRef = useRef<HTMLDivElement | null>(null);

  /** Copies a wallet address to the clipboard and shows inline feedback. */
  const handleCopy = (wallet: WalletOption): void => {
    if (typeof navigator.clipboard?.writeText === 'function') {
      void navigator.clipboard.writeText(wallet.address).then(() => {
        setCopied(wallet.id);
        window.setTimeout(() => setCopied(''), 2000);
      });
    }
  };

  /** Escape + focus management for the modal (same pattern as the picker). */
  useEffect(() => {
    if (!modalOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('.donate-dialog__copy');
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setModalOpen(false);
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
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
      setCopied('');
      previouslyFocused?.focus();
    };
  }, [modalOpen]);

  return (
    <div className="donate-card">
      <div className="donate-card__header">
        <span className="donate-card__icon" role="img" aria-label="coffee">
          ☕
        </span>
        <div className="donate-card__text">
          <h3 className="donate-card__title">Support the Project</h3>
          <p className="donate-card__subtitle">
            Free forever. Open source. Your support keeps it focused.
          </p>
        </div>
      </div>
      <button className="btn btn--primary donate-card__button" onClick={() => setModalOpen(true)}>
        ❤️ Donate
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
              <svg className="donate-dialog__coffee" width="80" height="80" viewBox="0 0 80 80" fill="none" focusable="false">
                {/* Coffee mug body */}
                <rect x="18" y="30" width="36" height="32" rx="4" fill="#6366f1" />
                {/* Mug handle */}
                <path d="M54 38 C64 38, 64 54, 54 54" stroke="#6366f1" strokeWidth="4" fill="none" strokeLinecap="round" />
                {/* Coffee surface */}
                <ellipse cx="36" cy="36" rx="16" ry="4" fill="#818cf8" />
                {/* Steam lines */}
                <path d="M28 24 C28 18, 32 16, 30 10" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
                <path d="M36 22 C36 16, 40 14, 38 8" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
                <path d="M44 24 C44 18, 48 16, 46 10" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
                {/* Heart on mug */}
                <path d="M30 44 C30 41, 33 39, 36 42 C39 39, 42 41, 42 44 C42 48, 36 52, 36 52 C36 52, 30 48, 30 44Z" fill="#ef4444" opacity="0.8" />
              </svg>
            </div>

            <div className="confirm-dialog__body">
              <h3 className="donate-dialog__title">Buy me a Coffee!</h3>
              <p className="donate-dialog__message">
                Your donations help me build better software.
              </p>
              <p className="donate-dialog__body">
                We accept Ethereum, Solana, USDC and USDT. It helps pay the bills and keep me
                alive.
              </p>

              {/* Wallets */}
              <div className="donate-dialog__wallets">
                {WALLETS.map((wallet) => (
                  <div className="donate-wallet" key={wallet.id}>
                    <div className="donate-wallet__header">
                      <span className="donate-wallet__icon" aria-hidden="true">
                        {wallet.icon}
                      </span>
                      <span className="donate-wallet__name">{wallet.name}</span>
                    </div>
                    <div className="donate-wallet__qr">
                      <img
                        className="donate-wallet__qr-img"
                        src={browser.runtime.getURL(wallet.qrPath)}
                        alt={wallet.qrAlt}
                      />
                    </div>
                    <div className="donate-wallet__row">
                      <span className="donate-wallet__address" title={wallet.address}>
                        {wallet.address}
                      </span>
                      <button
                        className="donate-dialog__copy"
                        aria-label={wallet.copyLabel}
                        onClick={() => handleCopy(wallet)}
                      >
                        {copied === wallet.id ? wallet.copiedLabel : '📋'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="donate-dialog__footer">
              <span>Open Source —</span>
              <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                Source Code
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

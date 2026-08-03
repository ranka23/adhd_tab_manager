/**
 * Tests for the DonateCard component.
 * Covers rendering, the modal open/close lifecycle, the SideRouter-style
 * crypto wallets (QR images + addresses), copy-to-clipboard feedback,
 * Escape/focus management, and the open-source footer link.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DonateCard } from '../../src/popup/components/DonateCard';
import {
  DONATION_ETH_ADDRESS,
  DONATION_QR_ETH,
  DONATION_QR_SOL,
  DONATION_SOL_ADDRESS,
  SOURCE_URL,
} from '../../src/shared/constants';
import { mocks, clearStorage } from '../setup';

describe('DonateCard', () => {
  afterEach(async () => {
    await clearStorage();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders the support card with the donate button', () => {
    render(<DonateCard />);
    expect(screen.getByText('Support the Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Donate/i })).toBeInTheDocument();
    // The modal is closed by default
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the modal with the SideRouter hero and both wallets', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Donate/i }));
    expect(screen.getByRole('dialog', { name: 'Donate to ADHD Tab Manager' })).toBeInTheDocument();
    expect(screen.getByText('Buy me a Coffee!')).toBeInTheDocument();
    expect(screen.getByText('Your donations help me build better software.')).toBeInTheDocument();
    // Both wallet names + addresses
    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('SOL')).toBeInTheDocument();
    expect(screen.getByText(DONATION_ETH_ADDRESS)).toBeInTheDocument();
    expect(screen.getByText(DONATION_SOL_ADDRESS)).toBeInTheDocument();
  });

  it('renders the wallet QR code images from bundled assets', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Donate/i }));
    const ethQr = screen.getByAltText('Ethereum wallet QR code');
    const solQr = screen.getByAltText('Solana wallet QR code');
    expect(ethQr).toHaveAttribute('src', `chrome-extension://test/${DONATION_QR_ETH}`);
    expect(solQr).toHaveAttribute('src', `chrome-extension://test/${DONATION_QR_SOL}`);
    expect(mocks.runtime.getURL).toHaveBeenCalledWith(DONATION_QR_ETH);
    expect(mocks.runtime.getURL).toHaveBeenCalledWith(DONATION_QR_SOL);
  });

  it('copies a wallet address to the clipboard with inline feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Donate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Ethereum address' }));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(DONATION_ETH_ADDRESS);
      expect(screen.getByRole('button', { name: 'Copy Ethereum address' }).textContent).toBe(
        '✓ Copied',
      );
    });
  });

  it('closes the modal on Escape and restores focus to the card button', () => {
    render(<DonateCard />);
    const trigger = screen.getByRole('button', { name: /Donate/i });
    trigger.focus(); // jsdom does not focus buttons on click
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the modal open when clicking inside it (stopPropagation)', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Donate/i }));
    // The inner dialog content stops propagation — clicking it must NOT close
    fireEvent.click(screen.getByRole('document'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Clicking the overlay itself closes the modal
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links to the open-source repository in the modal footer', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Donate/i }));
    const link = screen.getByRole('link', { name: 'Source Code' });
    expect(link).toHaveAttribute('href', SOURCE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});

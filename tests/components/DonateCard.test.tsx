/**
 * Tests for the DonateCard component.
 * Covers rendering, the modal open/close lifecycle, amount selection,
 * Escape/focus management, and the donate action opening a new tab.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DonateCard } from '../../src/popup/components/DonateCard';
import { DONATION_URL, DONATION_AMOUNTS } from '../../src/shared/constants';
import { mocks, clearStorage } from '../setup';

describe('DonateCard', () => {
  afterEach(async () => {
    await clearStorage();
    vi.clearAllMocks();
  });

  it('renders the support card with the donate button', () => {
    render(<DonateCard />);
    expect(screen.getByText('Support the Project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buy me a coffee/i })).toBeInTheDocument();
    // The modal is closed by default
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the modal and shows the amount presets', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Buy me a coffee/i }));
    expect(screen.getByRole('dialog', { name: 'Donate to ADHD Tab Manager' })).toBeInTheDocument();
    for (const value of DONATION_AMOUNTS) {
      expect(screen.getByRole('button', { name: `$${value}` })).toBeInTheDocument();
    }
  });

  it('selects an amount and opens the donation page in a new tab', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Buy me a coffee/i }));
    fireEvent.click(screen.getByRole('button', { name: '$10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Donate $10' }));
    expect(mocks.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining(DONATION_URL) }),
    );
    const createdUrl = mocks.tabs.create.mock.calls[0]![0].url as string;
    expect(new URL(createdUrl).searchParams.get('amount')).toBe('10');
    // Modal closes after donating
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal on Escape and restores focus to the card button', () => {
    render(<DonateCard />);
    const trigger = screen.getByRole('button', { name: /Buy me a coffee/i });
    trigger.focus(); // jsdom does not focus buttons on click
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the modal open when clicking inside it (stopPropagation)', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Buy me a coffee/i }));
    // The inner dialog content stops propagation — clicking it must NOT close
    fireEvent.click(screen.getByRole('document'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Clicking the overlay itself closes the modal
    fireEvent.click(screen.getByRole('dialog'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links to the open-source repository in the modal footer', () => {
    render(<DonateCard />);
    fireEvent.click(screen.getByRole('button', { name: /Buy me a coffee/i }));
    const link = screen.getByRole('link', { name: 'View source on GitHub' });
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(link).toHaveAttribute('target', '_blank');
  });
});

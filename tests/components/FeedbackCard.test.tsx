/**
 * Tests for the FeedbackCard component — the "Request New Feature or Report
 * a Bug" card on the Home tab (just above the Donate section).
 * Covers rendering, the GitHub Issues link, and the new-tab open behavior.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackCard } from '../../src/popup/components/FeedbackCard';
import { ISSUES_URL, SOURCE_URL } from '../../src/shared/constants';
import { mocks, clearStorage } from '../setup';

describe('FeedbackCard', () => {
  afterEach(async () => {
    await clearStorage();
    vi.clearAllMocks();
  });

  it('renders the feedback card with a GitHub Issues CTA', () => {
    render(<FeedbackCard />);
    expect(
      screen.getByText('Request a Feature or Report a Bug'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open GitHub Issues' })).toHaveAttribute(
      'href',
      ISSUES_URL,
    );
  });

  it('points at the issues page of the open-source repository', () => {
    expect(ISSUES_URL).toBe(`${SOURCE_URL}/issues`);
    expect(SOURCE_URL).toContain('github.com');
  });

  it('opens the issues page in a new tab with noopener semantics', () => {
    render(<FeedbackCard />);
    const link = screen.getByRole('link', { name: 'Open GitHub Issues' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('opens the issues page via browser.tabs.create and prevents default', () => {
    render(<FeedbackCard />);
    const link = screen.getByRole('link', { name: 'Open GitHub Issues' });
    fireEvent.click(link);
    expect(mocks.tabs.create).toHaveBeenCalledWith({ url: ISSUES_URL });
    // Default anchor navigation is prevented so only one tab opens
    expect(link).not.toHaveAttribute('href', 'javascript:;');
  });
});

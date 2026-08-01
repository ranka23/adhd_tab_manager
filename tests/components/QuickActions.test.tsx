/**
 * Tests for the QuickActions component.
 * Covers undo close feedback, close-all confirmation, badge, and pluralization.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActions } from '../../src/popup/components/QuickActions';

/** Local mirror of the component's props (interface is not exported). */
interface QuickActionsProps {
  tabCount: number;
  pinnedCount: number;
  onUndoClose: () => Promise<boolean>;
  onCloseAll: () => void;
  isFocusMode: boolean;
}

/** Renders QuickActions with defaults and returns the props used. */
const renderQuickActions = (partial: {
  tabCount?: number;
  pinnedCount?: number;
  onUndoClose?: () => Promise<boolean>;
  onCloseAll?: () => void;
  isFocusMode?: boolean;
} = {}): { props: QuickActionsProps } => {
  const props: QuickActionsProps = {
    tabCount: partial.tabCount ?? 5,
    pinnedCount: partial.pinnedCount ?? 2,
    onUndoClose: partial.onUndoClose ?? vi.fn(async () => true),
    onCloseAll: partial.onCloseAll ?? vi.fn(),
    isFocusMode: partial.isFocusMode ?? false,
  };
  render(<QuickActions {...props} />);
  return { props };
};

describe('QuickActions', () => {
  it('renders undo close, close all, and the tab count', () => {
    renderQuickActions();
    expect(screen.getByRole('button', { name: 'Restore last closed tab' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close all non-pinned tabs' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 tabs open')).toBeInTheDocument();
  });

  it('shows a badge with tabCount minus pinnedCount', () => {
    renderQuickActions({ tabCount: 10, pinnedCount: 3 });
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('hides the badge when there are no tabs', () => {
    renderQuickActions({ tabCount: 0, pinnedCount: 0 });
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('pluralizes the tab count label for a single tab', () => {
    renderQuickActions({ tabCount: 1, pinnedCount: 0 });
    expect(screen.getByText('1 tab open')).toBeInTheDocument();
  });

  it('shows pinned subtext only when pinnedCount is greater than zero', () => {
    renderQuickActions({ tabCount: 5, pinnedCount: 0 });
    expect(screen.queryByText('0 pinned')).not.toBeInTheDocument();
  });

  it('shows pinned subtext when there are pinned tabs', () => {
    renderQuickActions({ tabCount: 5, pinnedCount: 2 });
    expect(screen.getByText('2 pinned')).toBeInTheDocument();
  });

  it('calls onUndoClose and shows a success toast when a tab is restored', async () => {
    const { props } = renderQuickActions();
    fireEvent.click(screen.getByRole('button', { name: 'Restore last closed tab' }));
    expect(props.onUndoClose).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Tab restored! ↩️')).toBeInTheDocument();
  });

  it('shows "No tabs to restore" when undo close returns false', async () => {
    const onUndoClose = vi.fn(async () => false);
    renderQuickActions({ onUndoClose });
    fireEvent.click(screen.getByRole('button', { name: 'Restore last closed tab' }));
    expect(await screen.findByText('No tabs to restore')).toBeInTheDocument();
  });

  it('requires two clicks for close all: confirm first, then execute', () => {
    const { props } = renderQuickActions();
    const closeAllButton = screen.getByRole('button', { name: 'Close all non-pinned tabs' });

    // First click — confirmation state only
    fireEvent.click(closeAllButton);
    expect(props.onCloseAll).not.toHaveBeenCalled();
    expect(screen.getByText('Confirm?')).toBeInTheDocument();
    const confirmButton = screen.getByRole('button', {
      name: 'Confirm close all non-pinned tabs',
    });
    expect(confirmButton).toBeInTheDocument();
    // Badge is hidden while confirming
    expect(screen.queryByText('3')).not.toBeInTheDocument();

    // Second click — executes the close action
    fireEvent.click(confirmButton);
    expect(props.onCloseAll).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tabs closed (pinned kept)')).toBeInTheDocument();
  });
});

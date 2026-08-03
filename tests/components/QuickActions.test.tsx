/**
 * Tests for the QuickActions component.
 * Covers undo close feedback, the multi-window close picker, close-all
 * confirmation, badges, and pluralization.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickActions, type WindowCloseOption } from '../../src/popup/components/QuickActions';

/** Local mirror of the component's props (interface is not exported). */
interface QuickActionsProps {
  tabCount: number;
  pinnedCount: number;
  windowCount: number;
  windowOptions: WindowCloseOption[];
  onUndoClose: () => Promise<boolean>;
  onCloseWindow: (windowId: number) => void;
  onCloseAll: () => void;
  isFocusMode: boolean;
}

/** Renders QuickActions with defaults and returns the props used. */
const renderQuickActions = (partial: {
  tabCount?: number;
  pinnedCount?: number;
  windowCount?: number;
  windowOptions?: WindowCloseOption[];
  onUndoClose?: () => Promise<boolean>;
  onCloseWindow?: (windowId: number) => void;
  onCloseAll?: () => void;
  isFocusMode?: boolean;
} = {}): { props: QuickActionsProps } => {
  const props: QuickActionsProps = {
    tabCount: partial.tabCount ?? 5,
    pinnedCount: partial.pinnedCount ?? 2,
    windowCount: partial.windowCount ?? 1,
    windowOptions:
      partial.windowOptions ?? [{ id: 1, label: 'Window 1', tabCount: 5, nonPinnedCount: 3 }],
    onUndoClose: partial.onUndoClose ?? vi.fn(async () => true),
    onCloseWindow: partial.onCloseWindow ?? vi.fn(),
    onCloseAll: partial.onCloseAll ?? vi.fn(),
    isFocusMode: partial.isFocusMode ?? false,
  };
  render(<QuickActions {...props} />);
  return { props };
};

describe('QuickActions', () => {
  it('renders undo close, close window, close all, and the tab count', () => {
    renderQuickActions();
    expect(screen.getByRole('button', { name: 'Restore last closed tab' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close non-pinned tabs in this window' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close all non-pinned tabs' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 tabs open')).toBeInTheDocument();
  });

  it('badges both close actions with the non-pinned count', () => {
    renderQuickActions({
      tabCount: 10,
      pinnedCount: 3,
      windowOptions: [{ id: 1, label: 'Window 1', tabCount: 10, nonPinnedCount: 7 }],
    });
    // Close Window (closableTotal) + Close All (tabCount - pinnedCount) both = 7
    expect(screen.getAllByText('7')).toHaveLength(2);
  });

  it('hides the badge when there are no tabs', () => {
    renderQuickActions({ tabCount: 0, pinnedCount: 0, windowOptions: [] });
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
    expect(confirmButton.querySelector('.quick-action-btn__badge')).toBeNull();

    // Second click — executes the close action
    fireEvent.click(confirmButton);
    expect(props.onCloseAll).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Tabs closed (pinned kept)')).toBeInTheDocument();
  });

  it('with a single window, Close Window calls onCloseWindow directly (no picker)', () => {
    const { props } = renderQuickActions({
      windowOptions: [{ id: 7, label: 'Window 1', tabCount: 4, nonPinnedCount: 3 }],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close non-pinned tabs in this window' }),
    );
    expect(props.onCloseWindow).toHaveBeenCalledTimes(1);
    expect(props.onCloseWindow).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('with multiple windows, Close Window opens a picker listing every window', () => {
    const { props } = renderQuickActions({
      windowCount: 3,
      windowOptions: [
        { id: 1, label: 'Window 1', tabCount: 2, nonPinnedCount: 2 },
        { id: 2, label: 'Window 2', tabCount: 5, nonPinnedCount: 4 },
        { id: 3, label: 'Window 3', tabCount: 1, nonPinnedCount: 1 },
      ],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose a window to close non-pinned tabs' }),
    );
    // Picker modal opens with all three windows; nothing closed yet.
    const dialog = screen.getByRole('dialog', { name: 'Choose a window to close' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Window 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Window 2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Window 3/ })).toBeInTheDocument();
    expect(props.onCloseWindow).not.toHaveBeenCalled();

    // Choose Window 2 — onCloseWindow fires with its id and the picker closes.
    fireEvent.click(screen.getByRole('button', { name: /Window 2/ }));
    expect(props.onCloseWindow).toHaveBeenCalledTimes(1);
    expect(props.onCloseWindow).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape closes the window picker without closing anything', () => {
    const { props } = renderQuickActions({
      windowCount: 2,
      windowOptions: [
        { id: 1, label: 'Window 1', tabCount: 2, nonPinnedCount: 2 },
        { id: 2, label: 'Window 2', tabCount: 5, nonPinnedCount: 4 },
      ],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose a window to close non-pinned tabs' }),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(props.onCloseWindow).not.toHaveBeenCalled();
  });

  it('shows the window count subtext only when multiple windows are open', () => {
    renderQuickActions({ windowCount: 3, tabCount: 8, pinnedCount: 1 });
    expect(screen.getByText('3 windows')).toBeInTheDocument();
  });

  it('does not show the window count subtext for a single window', () => {
    renderQuickActions();
    expect(screen.queryByText('1 windows')).not.toBeInTheDocument();
  });
});

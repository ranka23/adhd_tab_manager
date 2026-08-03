/**
 * Tests for the TabGroup component.
 * Covers empty state, group header, and per-tab callbacks.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabGroup } from '../../src/popup/components/TabGroup';
import type { TabInfo, WindowInfo } from '../../src/popup/types';

/** Builds a TabInfo fixture with sensible defaults. */
const makeTab = (overrides: Partial<TabInfo> = {}): TabInfo => ({
  id: overrides.id ?? 1,
  url: overrides.url ?? 'https://example.com/page',
  title: overrides.title ?? 'Example Page',
  favIconUrl: overrides.favIconUrl ?? 'https://example.com/favicon.ico',
  active: overrides.active ?? false,
  pinned: overrides.pinned ?? false,
  windowId: overrides.windowId ?? 1,
  index: overrides.index ?? 0,
});

/** Local mirror of the component's props (interface is not exported). */
interface TabGroupProps {
  tabs: TabInfo[];
  windows: WindowInfo[];
  currentWindowId?: number | null;
  onCloseTab: (tabId: number) => void;
  onTabClick?: (tab: TabInfo) => void;
  onCloseWindow?: (windowId: number) => void;
}

/** Renders TabGroup with defaults and returns the props used. */
const renderGroup = (partial: {
  tabs?: TabInfo[];
  windows?: WindowInfo[];
  currentWindowId?: number | null;
  onCloseTab?: (tabId: number) => void;
  onTabClick?: (tab: TabInfo) => void;
  onCloseWindow?: (windowId: number) => void;
} = {}): ReturnType<typeof render> & { props: TabGroupProps } => {
  const props: TabGroupProps = {
    tabs: partial.tabs ?? [],
    windows: partial.windows ?? [{ id: 1, focused: true, type: 'normal' }],
    currentWindowId: partial.currentWindowId ?? 1,
    onCloseTab: partial.onCloseTab ?? vi.fn(),
  };
  if (partial.onTabClick) {
    props.onTabClick = partial.onTabClick;
  }
  if (partial.onCloseWindow) {
    props.onCloseWindow = partial.onCloseWindow;
  }
  const utils = render(<TabGroup {...props} />);
  return { ...utils, props };
};

describe('TabGroup', () => {
  it('shows the empty state when there are no tabs', () => {
    renderGroup({ tabs: [] });
    expect(screen.getByText('No tabs to show')).toBeInTheDocument();
    expect(screen.queryByText('Open Tabs')).not.toBeInTheDocument();
  });

  it('renders the group title with the tab count', () => {
    const tabs = [makeTab({ id: 1 }), makeTab({ id: 2, title: 'Second' }), makeTab({ id: 3, title: 'Third' })];
    const { container } = renderGroup({ tabs });
    expect(screen.getByText('Open Tabs')).toBeInTheDocument();
    expect(container.querySelector('.tab-group__count')).toHaveTextContent('3');
  });

  it('renders one tab card per tab', () => {
    const tabs = [
      makeTab({ id: 1, title: 'Alpha' }),
      makeTab({ id: 2, title: 'Beta' }),
    ];
    renderGroup({ tabs });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onCloseTab with the tab id when a close button is clicked', () => {
    const tabs = [
      makeTab({ id: 1, title: 'Alpha' }),
      makeTab({ id: 2, title: 'Beta' }),
    ];
    const { props } = renderGroup({ tabs });
    fireEvent.click(screen.getByRole('button', { name: 'Close tab: Beta' }));
    expect(props.onCloseTab).toHaveBeenCalledWith(2);
    expect(props.onCloseTab).toHaveBeenCalledTimes(1);
  });

  it('calls onTabClick with the tab when a card is clicked', () => {
    const tabs = [makeTab({ id: 1, title: 'Alpha' })];
    const onTabClick = vi.fn();
    renderGroup({ tabs, onTabClick });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to tab: Alpha' }));
    expect(onTabClick).toHaveBeenCalledWith(tabs[0]);
  });

  it('renders without onTabClick (optional prop)', () => {
    const tabs = [makeTab({ id: 1, title: 'Alpha' })];
    const { props } = renderGroup({ tabs });
    // Sanity check: the component rendered with onTabClick undefined.
    expect(props.onTabClick).toBeUndefined();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  /* ── MULTI-WINDOW ─────────────────────────────────────────── */
  it('hides window headers when a single window is open', () => {
    const tabs = [makeTab({ id: 1, title: 'Alpha' })];
    renderGroup({ tabs, windows: [{ id: 1, focused: true, type: 'normal' }] });
    expect(screen.queryByText('Window 1')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('groups tabs into per-window sections when multiple windows are open', () => {
    const tabs = [
      makeTab({ id: 1, title: 'Alpha', windowId: 1, index: 0 }),
      makeTab({ id: 2, title: 'Beta', windowId: 1, index: 1 }),
      makeTab({ id: 3, title: 'Gamma', windowId: 2, index: 0 }),
    ];
    renderGroup({
      tabs,
      windows: [
        { id: 1, focused: true, type: 'normal' },
        { id: 2, focused: false, type: 'normal' },
      ],
      currentWindowId: 1,
    });
    expect(screen.getByText('Window 1')).toBeInTheDocument();
    expect(screen.getByText('Window 2')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    // Counts appear in the window meta
    expect(screen.getByText('2 tabs')).toBeInTheDocument();
    expect(screen.getByText('1 tab')).toBeInTheDocument();
  });

  it('calls onCloseWindow with the window id for the window close button', () => {
    const tabs = [
      makeTab({ id: 1, title: 'Alpha', windowId: 1, index: 0 }),
      makeTab({ id: 3, title: 'Gamma', windowId: 2, index: 0 }),
    ];
    const onCloseWindow = vi.fn();
    renderGroup({
      tabs,
      windows: [
        { id: 1, focused: true, type: 'normal' },
        { id: 2, focused: false, type: 'normal' },
      ],
      currentWindowId: 1,
      onCloseWindow,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close 1 tab in Window 2' }));
    expect(onCloseWindow).toHaveBeenCalledWith(2);
  });

  it('does not render a close button for a window with only pinned tabs', () => {
    const tabs = [makeTab({ id: 3, title: 'Gamma', windowId: 2, index: 0, pinned: true })];
    renderGroup({
      tabs,
      windows: [
        { id: 1, focused: true, type: 'normal' },
        { id: 2, focused: false, type: 'normal' },
      ],
    });
    expect(screen.queryByRole('button', { name: /Close .* in Window 2/ })).not.toBeInTheDocument();
  });
});

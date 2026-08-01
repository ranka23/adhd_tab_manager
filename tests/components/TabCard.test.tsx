/**
 * Tests for the TabCard component.
 * Covers title/domain/favicon rendering, click behavior, and close action.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabCard } from '../../src/popup/components/TabCard';
import { mocks } from '../setup';
import type { TabInfo } from '../../src/popup/types';

/** Builds a TabInfo fixture with sensible defaults. */
const makeTab = (overrides: Partial<TabInfo> = {}): TabInfo => ({
  id: overrides.id ?? 1,
  url: overrides.url ?? 'https://www.example.com/docs/guide',
  title: overrides.title ?? 'Example Docs',
  favIconUrl: 'favIconUrl' in overrides ? overrides.favIconUrl : 'https://example.com/favicon.ico',
  active: overrides.active ?? false,
  pinned: overrides.pinned ?? false,
  windowId: overrides.windowId ?? 1,
  index: overrides.index ?? 0,
});

/** Local mirror of the component's props (interface is not exported). */
interface TabCardProps {
  tab: TabInfo;
  onClose: () => void;
  onClick: () => void;
  index: number;
}

/** Renders TabCard with defaults and returns the callbacks used. */
const renderCard = (partial: {
  tab?: TabInfo;
  onClose?: () => void;
  onClick?: () => void;
  index?: number;
} = {}): ReturnType<typeof render> & { onClose: () => void; onClick: () => void } => {
  const onClose = partial.onClose ?? vi.fn();
  const onClick = partial.onClick ?? vi.fn();
  const props: TabCardProps = {
    tab: partial.tab ?? makeTab(),
    onClose,
    onClick,
    index: partial.index ?? 0,
  };
  const utils = render(<TabCard {...props} />);
  return { ...utils, onClose, onClick };
};

describe('TabCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title, domain, and favicon image', () => {
    const { container } = renderCard();
    expect(screen.getByText('Example Docs')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    const favicon = container.querySelector('.tab-card__favicon');
    expect(favicon).toBeInTheDocument();
    expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
  });

  it('truncates long titles to 40 characters', () => {
    const longTitle = 'x'.repeat(50);
    renderCard({ tab: makeTab({ title: longTitle }) });
    expect(screen.getByText(`${'x'.repeat(37)}...`)).toBeInTheDocument();
  });

  it('shows the placeholder icon when there is no favicon', () => {
    renderCard({ tab: makeTab({ favIconUrl: undefined }) });
    expect(screen.getByText('📄')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('activates the tab in Chrome and calls onClick when the card is clicked', () => {
    const { onClick } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to tab: Example Docs' }));
    expect(mocks.tabs.update).toHaveBeenCalledWith(1, { active: true });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClose without triggering the card click when the close button is clicked', () => {
    const { onClick, onClose } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Close tab: Example Docs' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
    expect(mocks.tabs.update).not.toHaveBeenCalled();
  });

  it('activates the tab on Enter key press', () => {
    const { onClick } = renderCard();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Switch to tab: Example Docs' }), {
      key: 'Enter',
    });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(mocks.tabs.update).toHaveBeenCalledWith(1, { active: true });
  });
});

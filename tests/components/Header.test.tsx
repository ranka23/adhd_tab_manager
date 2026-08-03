/**
 * Tests for the Header component.
 * Covers title rendering, focus/dark mode toggles, and optional export/import actions.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../../src/popup/components/Header';

/** Local mirror of the component's props (interface is not exported). */
interface HeaderProps {
  isFocusMode: boolean;
  onToggleFocus: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

/** Renders Header with defaults and returns the props used. */
const renderHeader = (partial: {
  isFocusMode?: boolean;
  onToggleFocus?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onExport?: () => void;
  onImport?: () => void;
} = {}): { props: HeaderProps } => {
  const props: HeaderProps = {
    isFocusMode: partial.isFocusMode ?? false,
    onToggleFocus: partial.onToggleFocus ?? vi.fn(),
    isDarkMode: partial.isDarkMode ?? false,
    onToggleDarkMode: partial.onToggleDarkMode ?? vi.fn(),
  };
  if (partial.onExport) {
    props.onExport = partial.onExport;
  }
  if (partial.onImport) {
    props.onImport = partial.onImport;
  }
  render(<Header {...props} />);
  return { props };
};

describe('Header', () => {
  it('renders the app title with the brain icon fallback (no chrome.runtime in jsdom)', () => {
    renderHeader();
    expect(screen.getByText('ADHD Tabs')).toBeInTheDocument();
    expect(screen.getByLabelText('brain')).toHaveTextContent('🧠');
  });

  it('shows the inactive focus toggle and calls onToggleFocus when clicked', () => {
    const { props } = renderHeader();
    const focusButton = screen.getByRole('button', { name: 'Start focus mode' });
    expect(focusButton).toHaveTextContent('Focus');
    expect(focusButton).not.toHaveClass('focus-toggle--active');
    fireEvent.click(focusButton);
    expect(props.onToggleFocus).toHaveBeenCalledTimes(1);
  });

  it('shows the active focus toggle when focus mode is on', () => {
    renderHeader({ isFocusMode: true });
    const focusButton = screen.getByRole('button', { name: 'End focus mode' });
    expect(focusButton).toHaveTextContent('Focusing');
    expect(focusButton).toHaveClass('focus-toggle--active');
  });

  it('shows the dark mode toggle and calls onToggleDarkMode when clicked', () => {
    const { props } = renderHeader();
    const darkButton = screen.getByRole('button', { name: 'Switch to dark mode' });
    expect(darkButton).toHaveTextContent('🌙');
    fireEvent.click(darkButton);
    expect(props.onToggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('shows the light mode toggle when dark mode is on', () => {
    renderHeader({ isDarkMode: true });
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toHaveTextContent('☀️');
  });

  it('renders export and import buttons only when their callbacks are provided', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Export data' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import data' })).not.toBeInTheDocument();
  });

  it('renders export/import buttons and calls their callbacks when provided', () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    renderHeader({ onExport, onImport });
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import data' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('has NO side-panel toggle — the side panel is the default surface', () => {
    renderHeader();
    expect(screen.queryByRole('button', { name: 'Open in side panel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open in sidebar' })).not.toBeInTheDocument();
  });
});

/**
 * App.tsx — Root component wrapper.
 * Provides the top-level React context and renders the Popup.
 * This is where global providers (theme, context, etc.) would go.
 */

import React from 'react';
import { Popup } from './Popup';

/**
 * Root application component.
 * Wraps the Popup in any necessary providers or context.
 * Currently a simple wrapper — providers can be added as features grow.
 */
export const App: React.FC = () => {
  return <Popup />;
};

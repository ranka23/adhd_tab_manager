/**
 * FeedbackCard component — sits just above the Donate section on the Home tab.
 *
 * ADHD Tab Manager is open source. This card invites users to request a new
 * feature or report a bug on the GitHub Issues page. The link opens in a new
 * tab via browser.tabs.create so it works inside the MV3 extension sandbox.
 */

import React from 'react';
import { ISSUES_URL } from '../../shared/constants';
import { browser } from '../../shared/browser';

/** Renders the "Request New Feature or Report a Bug" card. */
export const FeedbackCard: React.FC = () => {
  /** Opens the GitHub Issues page in a new tab (CSP-safe, avoids double-open). */
  const handleOpen = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    void browser.tabs.create({ url: ISSUES_URL });
  };

  return (
    <div className="feedback-card">
      <div className="feedback-card__header">
        <span className="feedback-card__icon" role="img" aria-label="megaphone">
          📣
        </span>
        <div className="feedback-card__text">
          <h3 className="feedback-card__title">Request a Feature or Report a Bug</h3>
          <p className="feedback-card__subtitle">
            Found a bug or want something new? Let us know on GitHub.
          </p>
        </div>
      </div>
      <a
        className="btn btn--secondary feedback-card__button"
        href={ISSUES_URL}
        target="_blank"
        rel="noreferrer"
        onClick={handleOpen}
      >
        Open GitHub Issues
      </a>
    </div>
  );
};

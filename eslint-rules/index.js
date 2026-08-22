'use strict';

/**
 * Local guardrail rules. These encode the two structural invariants the framework rests
 * on, so that violating them is a build failure rather than a review comment.
 */
module.exports = {
  rules: {
    'no-locators-outside-page-objects': require('./no-locators-outside-page-objects'),
    'no-raw-http-outside-api-client': require('./no-raw-http-outside-api-client'),
  },
};

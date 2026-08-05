# E2E Testing Rules

- Use `getByRole`, `getByLabel`, or `getByText` as primary locators. Use
  `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM-structure locators.
- Keep every test independently runnable; do not share state between tests.
- Never use `page.waitForTimeout()`. Wait for a specific condition with a
  web-first assertion, `waitForURL()`, or `waitForResponse()`.
- Assert the observable business outcome, not implementation details.
- Use unique identifiers for created test data and clean it up after each test.
- Use the configured `storageState` for authentication; do not sign in through
  the UI in individual tests.

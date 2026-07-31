---
change_id: dashboard-ui-refactoring
title: Dashboard UI refactoring
status: implemented
created: 2026-07-31
updated: 2026-07-31
archived_at: null
---

## Notes

Refactor the dashboard UX:

- Show the month and year at the top.
- Show the balance below the month and year.
- Show that month's expense list below the balance.
- Remove the month selector.
- Place the new-expense form behind an Add Expense button:
  - use a dialog on large screens;
  - use a dedicated full-page form on small screens.
- Allow expenses in any past-month report, including an empty report, until either parent confirms that month.

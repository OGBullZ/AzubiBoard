Identify technical debt and rot in the current codebase. Focus on actionable items, not style nitpicks.

1. Run `git diff main...HEAD` to see what's changed recently.
2. Scan the touched files and their neighbors for:
   - **Dead code** added by recent changes (unused imports, vars, functions)
   - **Duplicated logic** that should be extracted (only if used 3+ times)
   - **Workarounds** marked with TODO/FIXME/HACK comments
   - **Inconsistencies** with the codebase's own patterns (see CLAUDE.md Rule 7)
   - **Missing error handling** at system boundaries (API calls, user input)
   - **Performance traps** obvious from the code (N+1s, missing memoization for expensive renders)
3. For AzubiBoard specifically:
   - Any new state updates missing the `{ ...data, ... }` spread?
   - New routes added without `lazy()`?
   - PHP routes in wrong order (general before specific)?
   - Any hardcoded values that belong in `.env`?

Output: a prioritized list. Mark each item XS/S/M/L. Skip anything that would require a full Sprint to fix.

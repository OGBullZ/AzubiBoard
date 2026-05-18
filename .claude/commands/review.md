Review the staged changes or last commit in this repository.

1. Run `git diff HEAD` (or `git diff --cached` if staged) to see what changed.
2. For each changed file, read the relevant section and its immediate callers.
3. Check against the project's Arbeitsregeln (CLAUDE.md):
   - No speculative features or abstractions beyond what was asked
   - Every changed line traces to the request
   - No silent assumptions — surface tradeoffs
4. Report:
   - **✓ Good:** patterns that are clean and correct
   - **⚠ Risk:** anything that could break, leak, or cause a regression
   - **💡 Suggestion:** improvements worth considering (don't apply unless asked)
5. Check for AzubiBoard-specific gotchas:
   - `setData` spreads: `{ ...data, foo }` pattern preserved?
   - PHP routes: specific before generic?
   - No dist/ or .env.server changes staged?
   - OneDrive clash files present?

Keep the review concise — one paragraph per file max.

Generate or update tests for recently changed files.

1. Run `git diff HEAD --name-only` to find changed files.
2. For each changed file in `src/lib/` or `src/features/`:
   - Read the file and identify pure functions or logic worth testing
   - Check `tests/` for an existing test file — extend it rather than creating a new one
   - Write tests that encode WHY the behavior matters (Rule 9: tests verify intent)
   - Each test name should read as a business rule: `"setData without spread deletes other keys"`
3. Priority order:
   - `src/lib/utils.js` — pure functions, easy to test, high value
   - `src/lib/migrations.js` — irreversible, must have regression tests
   - `src/lib/dataService.js` — save/load/conflict logic
   - New feature logic in `src/features/`
4. After writing, run `npm test` to verify all pass.
5. Report: which tests were added, what business rule each covers, final test count.

Do NOT test implementation details. Test the contract: given X input, expect Y output.

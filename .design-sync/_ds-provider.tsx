// Design-sync preview provider: applies the app's default "beta" look
// (data-design="beta") so previews render in the real brand tokens/fonts,
// and initializes i18next (side-effect import) so components using
// useTranslation() resolve real strings instead of suspending.
import '../src/lib/i18n';
import type { ReactNode } from 'react';

// Match the app's boot (main.tsx): the default look is "beta". useDesign()
// reads these off documentElement, so set them there — not just on the wrapper.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-design', 'beta');
  document.documentElement.setAttribute('data-accent', 'orange');
}

export function DesignRoot({ children }: { children?: ReactNode }) {
  return (
    <div
      data-design="beta"
      data-accent="orange"
      style={{
        background: 'var(--c-bg)',
        color: 'var(--c-tx)',
        fontFamily: 'var(--font-body)',
        padding: 24,
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  );
}

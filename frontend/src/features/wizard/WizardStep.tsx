import type { PropsWithChildren } from "react";

export function WizardStep({ children }: PropsWithChildren) {
  return (
    <section className="rounded-2xl bg-card p-6 shadow-lg">
      {children}
    </section>
  );
}

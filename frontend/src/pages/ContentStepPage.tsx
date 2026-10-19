/**
 * ContentStepPage — "/analysis/new/content"
 *
 * Step 2 of the analysis flow.
 * Persona summary chip (clickable → back to persona step).
 * Content type pill tabs: UI Screens / Static Image / Text.
 * Drag-and-drop upload zone (brand green on hover).
 * Upload preview strip with remove buttons.
 * "Run Analysis" brand accent pill — disabled until content uploaded.
 * On submit → navigate to /analysis/:jobId/running
 *
 * Design tokens: brand, border, card, primary, secondary, radius-full
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft } from "lucide-react";
import { Button, StepIndicator } from "@/components/design-system";
import { useWizardStore } from "@/stores/wizardStore";
import { usePersonasQuery } from "@/features/persona/usePersonas";
import { isQueueBusyError, useSubmitAnalyze } from "@/features/wizard/useSubmitAnalyze";
import { ScreenUploader } from "@/features/content/ScreenUploader";
import { StaticUploader } from "@/features/content/StaticUploader";
import { TextInput } from "@/features/content/TextInput";
import { discardContent } from "@/features/content/useUploadContent";

const STEPS = ["Persona", "Content", "Review"] as const;

/* ── Pill Tab trigger style ───────────────────────────────────────────── */

const tabTriggerStyle = (isActive: boolean): CSSProperties => ({
  padding: "6px 16px",
  borderRadius: "var(--radius-full)",
  fontSize: "14px",
  fontWeight: 500,
  background: isActive ? "var(--primary)" : "transparent",
  color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
  border: isActive ? "none" : "1px solid var(--border-medium)",
  cursor: "pointer",
  transition: "all 150ms",
  lineHeight: "1.5",
});

/* ── Page ─────────────────────────────────────────────────────────────── */

/** Which stored contentType each tab is allowed to submit. */
const TAB_CONTENT_TYPE = {
  screens: "ui_screens",
  static: "static",
  text: "text",
} as const;

type TabValue = keyof typeof TAB_CONTENT_TYPE;

export function ContentStepPage() {
  const navigate = useNavigate();
  const selectedPersonaId = useWizardStore((s) => s.selectedPersonaId);
  const contentId = useWizardStore((s) => s.contentId);
  const contentType = useWizardStore((s) => s.contentType);
  const [activeTab, setActiveTab] = useState<TabValue>("screens");
  const personasQuery = usePersonasQuery();
  const submitMutation = useSubmitAnalyze();
  const queueBusy = isQueueBusyError(submitMutation.error);

  const personas = personasQuery.data ?? [];
  const selectedPersona = personas.find((p) => p.id === selectedPersonaId);

  // Requiring contentType to match the visible tab stops the wizard submitting
  // content belonging to a tab the user has navigated away from. contentType was
  // previously stored but never read by anything.
  const contentMatchesTab = contentType === TAB_CONTENT_TYPE[activeTab];
  // A persona deleted since it was selected would otherwise just hide its chip
  // and still submit (to a 404). Only enforce once the list has loaded.
  const personaMissing = personasQuery.isSuccess && !selectedPersona;
  const canSubmit =
    Boolean(selectedPersonaId && contentId && contentMatchesTab) &&
    !personaMissing &&
    !submitMutation.isPending;

  return (
    <div className="min-h-screen px-6 py-10" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        {/* Step indicator */}
        <StepIndicator labels={STEPS} activeIndex={1} />

        {/* Heading */}
        <div>
          <h1
            className="font-semibold"
            style={{ fontSize: "24px", letterSpacing: "-0.24px", color: "var(--foreground)" }}
          >
            Add content
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Upload what you want the brain to evaluate.
          </p>
        </div>

        {/* Persona chip */}
        {selectedPersona && (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>Analyzing as:</span>
            <Link
              to="/analysis/new"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition"
              style={{
                background: "var(--color-brand-light)",
                color: "var(--color-brand-deep)",
                borderRadius: "var(--radius-full)",
                border: "1px solid rgba(15,167,110,0.2)",
              }}
            >
              {selectedPersona.name}
              <span style={{ color: "var(--color-brand-deep)", opacity: 0.6 }}>·</span>
              <span style={{ fontSize: "12px", opacity: 0.7 }}>change</span>
            </Link>
          </div>
        )}

        {/* Content type tabs */}
        <Tabs.Root
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as TabValue);
            // Radix unmounts the previous Tabs.Content (no forceMount), which
            // destroys that uploader's preview. Dropping the stored content keeps
            // the store consistent with what the user can actually see.
            discardContent();
          }}
          className="space-y-6"
        >
          <Tabs.List
            className="flex gap-2 flex-wrap"
            aria-label="Content type"
          >
            {[
              { value: "screens", label: "UI Screens" },
              { value: "static", label: "Static Image" },
              { value: "text", label: "Text" },
            ].map(({ value, label }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="transition"
                style={tabTriggerStyle(false)}
                data-active-style={JSON.stringify(tabTriggerStyle(true))}
                onFocus={(e) => {
                  // Radix handles active state via data-state
                }}
              >
                {label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <style>{`
            [data-radix-tabs-trigger][data-state="active"] {
              background: var(--primary) !important;
              color: var(--primary-foreground) !important;
              border: none !important;
            }
            [data-radix-tabs-trigger][data-state="inactive"] {
              background: transparent !important;
              color: var(--muted-foreground) !important;
              border: 1px solid var(--border-medium) !important;
            }
          `}</style>

          <Tabs.Content value="screens">
            <ScreenUploader />
          </Tabs.Content>
          <Tabs.Content value="static">
            <StaticUploader />
          </Tabs.Content>
          <Tabs.Content value="text">
            <TextInput />
          </Tabs.Content>
        </Tabs.Root>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            to="/analysis/new"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition"
            style={{ color: "var(--muted-foreground)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Persona
          </Link>

          <Button
            disabled={!canSubmit}
            onClick={() => submitMutation.mutate()}
            variant={canSubmit ? "brand" : "subtle"}
          >
            {submitMutation.isPending ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2"
                  style={{
                    borderColor: "var(--color-near-black)",
                    borderTopColor: "transparent",
                  }}
                />
                Starting…
              </>
            ) : (
              "Run Analysis"
            )}
          </Button>
        </div>
        {queueBusy ? (
          <p className="text-right text-sm font-medium" role="alert" style={{ color: "var(--destructive)" }}>
            The analysis queue is full. Please try again in a moment.
          </p>
        ) : submitMutation.isError ? (
          // e.g. a 422 for a missing provider key, or 404 for deleted content.
          <p className="text-right text-sm font-medium" role="alert" style={{ color: "var(--destructive)" }}>
            {`Could not start the analysis: ${submitMutation.error.message}`}
          </p>
        ) : null}
        {personaMissing && selectedPersonaId ? (
          <p className="text-right text-sm font-medium" role="alert" style={{ color: "var(--destructive)" }}>
            The selected persona no longer exists. Go back and choose another.
          </p>
        ) : null}

      </div>
    </div>
  );
}

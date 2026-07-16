import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { suggestPersonaField } from "@/lib/api";
import type { PersonaRead } from "@/lib/api-types";
import {
  cognitiveStateSectionSchema,
  demographicsSectionSchema,
  personaCreateSchema,
  type PersonaFormValues,
} from "./personaFormSchema";
import { useCreatePersonaMutation } from "./usePersonas";

type PersonaFormProps = {
  onCreated: (persona: PersonaRead) => void;
};

const STEPS = ["Demographics", "Psychographics", "Cognitive State", "Environment"] as const;
type StepIndex = 0 | 1 | 2 | 3;

const fieldStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-full)",
  border: "1px solid var(--border-medium)",
  background: "var(--background)",
  padding: "8px 16px",
  fontSize: "14px",
  color: "var(--foreground)",
  outline: "none",
  transition: "border-color 150ms",
  fontFamily: "var(--font-sans)",
};

const textareaStyle: React.CSSProperties = {
  ...fieldStyle,
  borderRadius: "var(--radius)",
  minHeight: "88px",
  resize: "vertical",
  padding: "10px 16px",
};

const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  appearance: "none",
  cursor: "pointer",
};

const defaultValues: PersonaFormValues = {
  name: "",
  demographics: { age: 0, role: "", background: "" },
  psychographics: { goals: [], values: [], motivations: [] },
  cognitive_state: { attention_span: "medium", stress_level: "moderate", tech_literacy: "intermediate" },
  environment: { device: "desktop", location: "office", ambient: "" },
};

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: StepIndex }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "flex-start", flex: i < 3 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: done
                    ? "var(--color-brand)"
                    : active
                    ? "var(--primary)"
                    : "var(--muted)",
                  color: done
                    ? "var(--color-near-black)"
                    : active
                    ? "var(--primary-foreground)"
                    : "var(--muted-foreground)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  transition: "background 200ms",
                }}
              >
                {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < 3 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  marginTop: 14,
                  background: done ? "var(--color-brand)" : "var(--border)",
                  transition: "background 200ms",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AIFillButton({
  field,
  loading,
  disabled,
  onFill,
}: {
  field: string;
  loading: boolean;
  disabled: boolean;
  onFill: (field: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onFill(field)}
      disabled={loading || disabled}
      title={disabled ? "Fill Demographics first to enable AI" : "Auto-fill with AI"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        border: `1px solid ${disabled ? "var(--border-medium)" : "var(--color-brand)"}`,
        background: "transparent",
        color: disabled ? "var(--muted-foreground)" : "var(--color-brand-deep)",
        fontSize: 11,
        fontWeight: 500,
        cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 150ms",
        lineHeight: 1,
      }}
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
      AI
    </button>
  );
}

function FieldLabel({
  label,
  htmlFor,
  field,
  loadingField,
  hasDemographics,
  onFill,
}: {
  label: string;
  htmlFor?: string;
  field: string;
  loadingField: string | null;
  hasDemographics: boolean;
  onFill: (field: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span
        id={htmlFor ? `label-${htmlFor}` : undefined}
        className="text-sm font-medium"
        style={{ color: "var(--foreground)" }}
      >
        {label}
      </span>
      <AIFillButton
        field={field}
        loading={loadingField === field}
        disabled={!hasDemographics}
        onFill={onFill}
      />
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function PersonaForm({ onCreated }: PersonaFormProps) {
  const mutation = useCreatePersonaMutation();
  const [step, setStep] = useState<StepIndex>(0);
  const [loadingField, setLoadingField] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<PersonaFormValues>({
    resolver: zodResolver(personaCreateSchema),
    defaultValues,
    mode: "onBlur",
  });

  const values = watch();

  const hasDemographics =
    demographicsSectionSchema.safeParse({
      name: values.name,
      demographics: {
        age: values.demographics.age,
        role: values.demographics.role,
        background: values.demographics.background || null,
      },
    }).success;

  async function fillField(field: string) {
    setLoadingField(field);
    try {
      const result = await suggestPersonaField({
        name: values.name,
        age: values.demographics.age,
        role: values.demographics.role,
        background: values.demographics.background || null,
        field,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setValue(field as any, result.value as any, { shouldDirty: true });
    } catch {
      // silently ignore — user can retry
    } finally {
      setLoadingField(null);
    }
  }

  async function handleNext() {
    if (step === 0) {
      const valid = await trigger(["name", "demographics.age", "demographics.role"]);
      if (!valid) return;
    }
    setStep((s) => (Math.min(s + 1, 3) as StepIndex));
  }

  function handleBack() {
    setStep((s) => (Math.max(s - 1, 0) as StepIndex));
  }

  const onSubmit = handleSubmit(async (submittedValues) => {
    const created = await mutation.mutateAsync({
      ...submittedValues,
      demographics: { ...submittedValues.demographics, background: submittedValues.demographics.background || null },
      environment: { ...submittedValues.environment, ambient: submittedValues.environment.ambient || null },
    });
    onCreated(created);
  });

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "24px",
        boxShadow: "var(--shadow)",
      }}
    >
      <style>{`
        .persona-field:focus {
          border-color: var(--color-brand) !important;
          outline: 1px solid var(--color-brand) !important;
        }
      `}</style>

      <div className="space-y-1" style={{ marginBottom: 20 }}>
        <h2 className="font-semibold" style={{ fontSize: 18, letterSpacing: "-0.2px", color: "var(--foreground)" }}>
          Create Persona
        </h2>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Capture who will experience your content before you analyze it.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <StepIndicator current={step} />
      </div>

      {/* ── Step 0: Demographics ── */}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 md:col-span-2" htmlFor="persona-name">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Persona Name</span>
            <input id="persona-name" aria-label="Persona Name" className="persona-field" style={fieldStyle} {...register("name")} />
            {errors.name && <span className="text-xs" style={{ color: "var(--color-error)" }}>{errors.name.message}</span>}
          </label>
          <label className="grid gap-1.5" htmlFor="persona-age">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Age</span>
            <input id="persona-age" aria-label="Age" type="number" className="persona-field" style={fieldStyle} {...register("demographics.age", { valueAsNumber: true })} />
            {errors.demographics?.age && <span className="text-xs" style={{ color: "var(--color-error)" }}>{errors.demographics.age.message}</span>}
          </label>
          <label className="grid gap-1.5" htmlFor="persona-role">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Role</span>
            <input id="persona-role" aria-label="Role" className="persona-field" style={fieldStyle} {...register("demographics.role")} />
            {errors.demographics?.role && <span className="text-xs" style={{ color: "var(--color-error)" }}>{errors.demographics.role.message}</span>}
          </label>
          <label className="grid gap-1.5 md:col-span-2" htmlFor="persona-background">
            <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>Background</span>
            <textarea id="persona-background" aria-label="Background" className="persona-field" style={textareaStyle} {...register("demographics.background")} />
          </label>
        </div>
      )}

      {/* ── Step 1: Psychographics ── */}
      {step === 1 && (
        <div className="grid gap-4">
          <Controller
            name="psychographics.goals"
            control={control}
            render={({ field }) => (
              <label className="grid gap-1.5" htmlFor="persona-goals">
                <FieldLabel label="Goals" htmlFor="persona-goals" field="psychographics.goals" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
                <textarea
                  id="persona-goals"
                  aria-label="Goals"
                  className="persona-field"
                  style={textareaStyle}
                  value={field.value.join(", ")}
                  onChange={(e) => field.onChange(splitList(e.target.value))}
                />
              </label>
            )}
          />
          <Controller
            name="psychographics.values"
            control={control}
            render={({ field }) => (
              <label className="grid gap-1.5" htmlFor="persona-values">
                <FieldLabel label="Values" htmlFor="persona-values" field="psychographics.values" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
                <textarea
                  id="persona-values"
                  aria-label="Values"
                  className="persona-field"
                  style={textareaStyle}
                  value={field.value.join(", ")}
                  onChange={(e) => field.onChange(splitList(e.target.value))}
                />
              </label>
            )}
          />
          <Controller
            name="psychographics.motivations"
            control={control}
            render={({ field }) => (
              <label className="grid gap-1.5" htmlFor="persona-motivations">
                <FieldLabel label="Motivations" htmlFor="persona-motivations" field="psychographics.motivations" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
                <textarea
                  id="persona-motivations"
                  aria-label="Motivations"
                  className="persona-field"
                  style={textareaStyle}
                  value={field.value.join(", ")}
                  onChange={(e) => field.onChange(splitList(e.target.value))}
                />
              </label>
            )}
          />
        </div>
      )}

      {/* ── Step 2: Cognitive State ── */}
      {step === 2 && (
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1.5" htmlFor="persona-attention">
            <FieldLabel label="Attention Span" htmlFor="persona-attention" field="cognitive_state.attention_span" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <select id="persona-attention" aria-label="Attention Span" className="persona-field" style={selectStyle} {...register("cognitive_state.attention_span")}>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
          <label className="grid gap-1.5" htmlFor="persona-stress">
            <FieldLabel label="Stress Level" htmlFor="persona-stress" field="cognitive_state.stress_level" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <select id="persona-stress" aria-label="Stress Level" className="persona-field" style={selectStyle} {...register("cognitive_state.stress_level")}>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="grid gap-1.5" htmlFor="persona-tech">
            <FieldLabel label="Tech Literacy" htmlFor="persona-tech" field="cognitive_state.tech_literacy" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <select id="persona-tech" aria-label="Tech Literacy" className="persona-field" style={selectStyle} {...register("cognitive_state.tech_literacy")}>
              <option value="novice">Novice</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>
          </label>
        </div>
      )}

      {/* ── Step 3: Environment ── */}
      {step === 3 && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5" htmlFor="persona-device">
            <FieldLabel label="Device" htmlFor="persona-device" field="environment.device" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <select id="persona-device" aria-label="Device" className="persona-field" style={selectStyle} {...register("environment.device")}>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
              <option value="desktop">Desktop</option>
            </select>
          </label>
          <label className="grid gap-1.5" htmlFor="persona-location">
            <FieldLabel label="Location" htmlFor="persona-location" field="environment.location" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <select id="persona-location" aria-label="Location" className="persona-field" style={selectStyle} {...register("environment.location")}>
              <option value="commute">Commute</option>
              <option value="home">Home</option>
              <option value="office">Office</option>
              <option value="store">Store</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1.5 md:col-span-2" htmlFor="persona-ambient">
            <FieldLabel label="Ambient" htmlFor="persona-ambient" field="environment.ambient" loadingField={loadingField} hasDemographics={hasDemographics} onFill={fillField} />
            <input id="persona-ambient" aria-label="Ambient" className="persona-field" style={fieldStyle} {...register("environment.ambient")} />
          </label>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between" style={{ marginTop: 24, gap: 12 }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition disabled:invisible"
          style={{
            border: "1px solid var(--border-medium)",
            background: "var(--background)",
            color: "var(--foreground)",
            borderRadius: "var(--radius-full)",
          }}
        >
          ← Back
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius-full)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            Next →
          </button>
        ) : (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center rounded-full px-5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              borderRadius: "var(--radius-full)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {mutation.isPending ? "Saving…" : "Save Persona"}
          </button>
        )}
      </div>
    </form>
  );
}

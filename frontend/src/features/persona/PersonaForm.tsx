import { zodResolver } from "@hookform/resolvers/zod";
import * as Tabs from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import { Controller, useForm } from "react-hook-form";
import type { PersonaRead } from "@/lib/api-types";
import {
  cognitiveStateSectionSchema,
  demographicsSectionSchema,
  environmentSectionSchema,
  personaCreateSchema,
  type PersonaFormValues,
  psychographicsSectionSchema,
} from "./personaFormSchema";
import { PersonaTabProgress } from "./PersonaTabProgress";
import { useCreatePersonaMutation } from "./usePersonas";

type PersonaFormProps = {
  onCreated: (persona: PersonaRead) => void;
};

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-md hover:shadow-lg",
        secondary: "border border-border bg-card text-card-foreground hover:bg-accent",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

const tabTriggerClassName =
  "rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition data-[state=active]:border-primary data-[state=active]:bg-accent data-[state=active]:text-foreground";

const fieldClassName =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

const textareaClassName = `${fieldClassName} min-h-24 resize-y`;

const selectClassName = `${fieldClassName} appearance-none`;

const defaultValues: PersonaFormValues = {
  name: "",
  demographics: {
    age: 0,
    role: "",
    background: "",
  },
  psychographics: {
    goals: [],
    values: [],
    motivations: [],
  },
  cognitive_state: {
    attention_span: "medium",
    stress_level: "moderate",
    tech_literacy: "intermediate",
  },
  environment: {
    device: "desktop",
    location: "office",
    ambient: "",
  },
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasDirtyField(value: unknown): boolean {
  if (!value) {
    return false;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return Object.values(value).some((entry) => hasDirtyField(entry));
}

export function PersonaForm({ onCreated }: PersonaFormProps) {
  const mutation = useCreatePersonaMutation();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { dirtyFields, errors },
  } = useForm<PersonaFormValues>({
    resolver: zodResolver(personaCreateSchema),
    defaultValues,
    mode: "onBlur",
  });

  const values = watch();

  const completedTabs = [
    hasDirtyField(dirtyFields.name) || hasDirtyField(dirtyFields.demographics)
      ? demographicsSectionSchema.safeParse({
          name: values.name,
          demographics: {
            age: values.demographics.age,
            role: values.demographics.role,
            background: values.demographics.background || null,
          },
        }).success
      : false,
    hasDirtyField(dirtyFields.psychographics)
      ? psychographicsSectionSchema.safeParse({
          psychographics: values.psychographics,
        }).success
      : false,
    hasDirtyField(dirtyFields.cognitive_state)
      ? cognitiveStateSectionSchema.safeParse({
          cognitive_state: values.cognitive_state,
        }).success
      : false,
    hasDirtyField(dirtyFields.environment)
      ? environmentSectionSchema.safeParse({
          environment: {
            ...values.environment,
            ambient: values.environment.ambient || null,
          },
        }).success
      : false,
  ].filter(Boolean).length as 0 | 1 | 2 | 3 | 4;

  const onSubmit = handleSubmit(async (submittedValues) => {
    const createdPersona = await mutation.mutateAsync({
      ...submittedValues,
      demographics: {
        ...submittedValues.demographics,
        background: submittedValues.demographics.background || null,
      },
      environment: {
        ...submittedValues.environment,
        ambient: submittedValues.environment.ambient || null,
      },
    });
    onCreated(createdPersona);
  });

  return (
    <form className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-lg" onSubmit={onSubmit}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Create Persona</h2>
        <p className="text-sm text-muted-foreground">
          Capture who will experience your content before you analyze it.
        </p>
      </div>

      <PersonaTabProgress completedCount={completedTabs} />

      <Tabs.Root defaultValue="demographics" className="space-y-6">
        <Tabs.List className="grid gap-2 md:grid-cols-4">
          <Tabs.Trigger value="demographics" className={tabTriggerClassName}>
            Demographics
          </Tabs.Trigger>
          <Tabs.Trigger value="psychographics" className={tabTriggerClassName}>
            Psychographics
          </Tabs.Trigger>
          <Tabs.Trigger value="cognitive-state" className={tabTriggerClassName}>
            Cognitive State
          </Tabs.Trigger>
          <Tabs.Trigger value="environment" className={tabTriggerClassName}>
            Environment
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="demographics" className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Persona Name</span>
            <input className={fieldClassName} {...register("name")} />
            {errors.name ? (
              <span className="text-sm text-destructive">{errors.name.message}</span>
            ) : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Age</span>
            <input
              type="number"
              className={fieldClassName}
              {...register("demographics.age", { valueAsNumber: true })}
            />
            {errors.demographics?.age ? (
              <span className="text-sm text-destructive">
                {errors.demographics.age.message}
              </span>
            ) : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Role</span>
            <input className={fieldClassName} {...register("demographics.role")} />
            {errors.demographics?.role ? (
              <span className="text-sm text-destructive">
                {errors.demographics.role.message}
              </span>
            ) : null}
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Background</span>
            <textarea
              className={textareaClassName}
              {...register("demographics.background")}
            />
          </label>
        </Tabs.Content>

        <Tabs.Content value="psychographics" className="grid gap-4">
          <Controller
            name="psychographics.goals"
            control={control}
            render={({ field }) => (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">Goals</span>
                <textarea
                  className={textareaClassName}
                  value={field.value.join(", ")}
                  onChange={(event) => field.onChange(splitList(event.target.value))}
                />
              </label>
            )}
          />
          <Controller
            name="psychographics.values"
            control={control}
            render={({ field }) => (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">Values</span>
                <textarea
                  className={textareaClassName}
                  value={field.value.join(", ")}
                  onChange={(event) => field.onChange(splitList(event.target.value))}
                />
              </label>
            )}
          />
          <Controller
            name="psychographics.motivations"
            control={control}
            render={({ field }) => (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-foreground">Motivations</span>
                <textarea
                  className={textareaClassName}
                  value={field.value.join(", ")}
                  onChange={(event) => field.onChange(splitList(event.target.value))}
                />
              </label>
            )}
          />
        </Tabs.Content>

        <Tabs.Content value="cognitive-state" className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Attention Span</span>
            <select className={selectClassName} {...register("cognitive_state.attention_span")}>
              <option value="short">short</option>
              <option value="medium">medium</option>
              <option value="long">long</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Stress Level</span>
            <select className={selectClassName} {...register("cognitive_state.stress_level")}>
              <option value="low">low</option>
              <option value="moderate">moderate</option>
              <option value="high">high</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Tech Literacy</span>
            <select className={selectClassName} {...register("cognitive_state.tech_literacy")}>
              <option value="novice">novice</option>
              <option value="intermediate">intermediate</option>
              <option value="expert">expert</option>
            </select>
          </label>
        </Tabs.Content>

        <Tabs.Content value="environment" className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Device</span>
            <select className={selectClassName} {...register("environment.device")}>
              <option value="mobile">mobile</option>
              <option value="tablet">tablet</option>
              <option value="desktop">desktop</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-foreground">Location</span>
            <select className={selectClassName} {...register("environment.location")}>
              <option value="commute">commute</option>
              <option value="home">home</option>
              <option value="office">office</option>
              <option value="store">store</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Ambient</span>
            <input className={fieldClassName} {...register("environment.ambient")} />
          </label>
        </Tabs.Content>
      </Tabs.Root>

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Save the persona to reuse it in the library.
        </span>
        <button
          type="submit"
          className={buttonVariants({ variant: "primary" })}
          disabled={mutation.isPending}
        >
          Save Persona
        </button>
      </div>
    </form>
  );
}

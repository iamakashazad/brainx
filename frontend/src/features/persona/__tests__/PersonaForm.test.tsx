import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonaForm } from "../PersonaForm";
import { personaCreateSchema } from "../personaFormSchema";

function renderPersonaForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onCreated = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <PersonaForm onCreated={onCreated} />
    </QueryClientProvider>,
  );

  return { onCreated };
}

describe("personaCreateSchema", () => {
  it("rejects age 999 at the demographics.age path", () => {
    const result = personaCreateSchema.safeParse({
      name: "Focused Designer",
      demographics: {
        age: 999,
        role: "Designer",
        background: "Builds interface reviews.",
      },
      psychographics: {
        goals: ["ship"],
        values: ["clarity"],
        motivations: ["reduce friction"],
      },
      cognitive_state: {
        attention_span: "medium",
        stress_level: "moderate",
        tech_literacy: "expert",
      },
      environment: {
        device: "desktop",
        location: "office",
        ambient: "quiet",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["demographics", "age"]);
  });

  it("rejects an empty role", () => {
    const result = personaCreateSchema.safeParse({
      name: "Focused Designer",
      demographics: {
        age: 29,
        role: "",
        background: "Builds interface reviews.",
      },
      psychographics: {
        goals: ["ship"],
        values: ["clarity"],
        motivations: ["reduce friction"],
      },
      cognitive_state: {
        attention_span: "medium",
        stress_level: "moderate",
        tech_literacy: "expert",
      },
      environment: {
        device: "desktop",
        location: "office",
        ambient: "quiet",
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["demographics", "role"]);
  });
});

describe("PersonaForm", () => {
  it("renders the Demographics step by default with expected fields", () => {
    renderPersonaForm();

    expect(screen.getByLabelText("Persona Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Age")).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByLabelText("Background")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
  });

  it("advances to Psychographics step after valid demographics input", async () => {
    const user = userEvent.setup();
    renderPersonaForm();

    await user.type(screen.getByLabelText("Persona Name"), "Focused Designer");
    await user.type(screen.getByLabelText("Age"), "29");
    await user.type(screen.getByLabelText("Role"), "Product Designer");

    await user.click(screen.getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Goals" })).toBeInTheDocument();
    });
  });

  it("submits a valid persona and returns the created record", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderPersonaForm();

    // Step 0: Demographics
    await user.type(screen.getByLabelText("Persona Name"), "Focused Designer");
    await user.type(screen.getByLabelText("Age"), "29");
    await user.type(screen.getByLabelText("Role"), "Product Designer");
    await user.type(screen.getByLabelText("Background"), "Builds interface reviews.");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 1: Psychographics
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Goals" })).toBeInTheDocument());
    await user.type(screen.getByRole("textbox", { name: "Goals" }), "ship faster");
    await user.type(screen.getByRole("textbox", { name: "Values" }), "clarity");
    await user.type(screen.getByRole("textbox", { name: "Motivations" }), "reduce friction");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 2: Cognitive State
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Attention Span" })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox", { name: "Attention Span" }), "medium");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stress Level" }), "moderate");
    await user.selectOptions(screen.getByRole("combobox", { name: "Tech Literacy" }), "expert");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Step 3: Environment
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Device" })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole("combobox", { name: "Device" }), "desktop");
    await user.selectOptions(screen.getByRole("combobox", { name: "Location" }), "office");
    await user.type(screen.getByRole("textbox", { name: "Ambient" }), "quiet");

    await user.click(screen.getByRole("button", { name: "Save Persona" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "p-created",
          name: "Focused Designer",
        }),
      );
    });
  });
});

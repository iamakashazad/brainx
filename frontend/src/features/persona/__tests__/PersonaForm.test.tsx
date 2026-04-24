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
  it("renders the four exact tab labels", () => {
    renderPersonaForm();

    expect(screen.getByRole("tab", { name: "Demographics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Psychographics" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cognitive State" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Environment" })).toBeInTheDocument();
  });

  it("advances persona tab progress after valid demographics input", async () => {
    const user = userEvent.setup();
    renderPersonaForm();

    await user.type(screen.getByLabelText("Persona Name"), "Focused Designer");
    await user.type(screen.getByLabelText("Age"), "29");
    await user.type(screen.getByLabelText("Role"), "Product Designer");
    await user.type(screen.getByLabelText("Background"), "Builds interface reviews.");
    await user.tab();

    await waitFor(() => {
      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    });
  });

  it("submits a valid persona and returns the created record", async () => {
    const user = userEvent.setup();
    const { onCreated } = renderPersonaForm();

    await user.type(screen.getByLabelText("Persona Name"), "Focused Designer");
    await user.type(screen.getByLabelText("Age"), "29");
    await user.type(screen.getByLabelText("Role"), "Product Designer");
    await user.type(screen.getByLabelText("Background"), "Builds interface reviews.");

    await user.click(screen.getByRole("tab", { name: "Psychographics" }));
    await user.type(screen.getByLabelText("Goals"), "ship faster");
    await user.type(screen.getByLabelText("Values"), "clarity");
    await user.type(screen.getByLabelText("Motivations"), "reduce friction");

    await user.click(screen.getByRole("tab", { name: "Cognitive State" }));
    await user.selectOptions(screen.getByLabelText("Attention Span"), "medium");
    await user.selectOptions(screen.getByLabelText("Stress Level"), "moderate");
    await user.selectOptions(screen.getByLabelText("Tech Literacy"), "expert");

    await user.click(screen.getByRole("tab", { name: "Environment" }));
    await user.selectOptions(screen.getByLabelText("Device"), "desktop");
    await user.selectOptions(screen.getByLabelText("Location"), "office");
    await user.type(screen.getByLabelText("Ambient"), "quiet");

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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPersona, deletePersona, listPersonas } from "@/lib/api";
import type { PersonaCreate } from "@/lib/api-types";

export function usePersonasQuery() {
  return useQuery({
    queryKey: ["personas"],
    queryFn: ({ signal }) => listPersonas(signal),
  });
}

export function useCreatePersonaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PersonaCreate) => createPersona(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personas"] });
    },
  });
}

export function useDeletePersonaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (personaId: string) => deletePersona(personaId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personas"] });
    },
  });
}

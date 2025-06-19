import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface UseEnvVariablesOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useEnvVariables(options: UseEnvVariablesOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["env-variables"],
    queryFn: async () => {
      const response = await fetch("/api/admin/env");
      if (!response.ok) {
        throw new Error("Failed to fetch environment variables");
      }
      return response.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      const response = await fetch("/api/admin/env", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        throw new Error("Failed to update environment variables");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["env-variables"] });
      options.onSuccess?.();
    },
    onError: (error: Error) => {
      options.onError?.(error);
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateVariables: mutation.mutate,
    isUpdating: mutation.isPending,
  };
} 
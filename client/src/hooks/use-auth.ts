import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertUser, type User } from "@shared/schema";
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const userId = localStorage.getItem("persona_user_id");
      if (!userId) return null;
      
      try {
        const res = await fetch(`/api/user/${userId}`);
        if (!res.ok) {
          if (res.status === 404) {
            localStorage.removeItem("persona_user_id");
            return null;
          }
          throw new Error("Failed to fetch user");
        }
        return await res.json();
      } catch (error) {
        console.error("Error fetching user session:", error);
        return null;
      }
    },
    staleTime: Infinity,
  });

  return { user, isLoading };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const validated = api.auth.login.input.parse(data);
      
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          const error = parseWithLogging(api.auth.login.responses[401], await res.json(), "auth.login.error");
          throw new Error(error.message || "Invalid credentials");
        }
        throw new Error("Failed to login");
      }

      return parseWithLogging(api.auth.login.responses[200], await res.json(), "auth.login.success");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/me"], data);
      localStorage.setItem("persona_user_id", data.id);
      localStorage.setItem("persona_user", JSON.stringify(data));
    }
  });
}

export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsertUser) => {
      const validated = api.auth.register.input.parse(data);
      
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = parseWithLogging(api.auth.register.responses[400], await res.json(), "auth.register.error");
          throw new Error(error.message || "Registration failed");
        }
        throw new Error("Failed to register");
      }

      return parseWithLogging(api.auth.register.responses[201], await res.json(), "auth.register.success");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/me"], data);
      localStorage.setItem("persona_user_id", data.id);
      localStorage.setItem("persona_user", JSON.stringify(data));
    }
  });
}

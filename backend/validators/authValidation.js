import { z } from "zod";

export const signupSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  remember: z.boolean().optional()
});

export const forgotSchema = z.object({
  email: z.string().email()
});

export const resetSchema = z.object({
  token: z.string(),
  password: z.string().min(6)
});

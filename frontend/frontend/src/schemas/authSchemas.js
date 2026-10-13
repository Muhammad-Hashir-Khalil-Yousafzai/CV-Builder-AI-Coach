import { z } from "zod";

// Client-side validation: catches obvious mistakes instantly.
// The server (Django) is still the real authority — see signupSchema's
// email rule note below.
export const signupSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "At least one uppercase letter")
      .regex(/[0-9]/, "At least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
// Note: this schema does NOT check whether the email is already taken.
// That check can only be trusted from the server — see AuthContext.signup,
// which surfaces the 400 response from Django as a field error.

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

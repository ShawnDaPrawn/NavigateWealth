import { z } from "zod";

export const inviteUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "adviser", "paraplanner", "compliance"]),
  moduleAccess: z.array(z.string()).optional(),
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export const updateProfileSchema = z.object({
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  role: z.enum(["admin", "adviser", "paraplanner", "compliance"]).optional(),
  managerId: z.string().optional().nullable(),
});

export const commissionSchema = z.object({
  commissionSplit: z.number().min(0).max(100),
  commissionEntity: z.enum(["personal", "company"]),
});
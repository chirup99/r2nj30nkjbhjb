import { z } from "zod";

export const cardSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pitch"),
    title: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("reel"),
    title: z.string(),
    url: z.string(),
  }),
  z.object({
    type: z.literal("revenue"),
    title: z.string(),
    value: z.string(),
    revenue: z.string().optional(),
    imageUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal("traction"),
    title: z.string(),
    value: z.string().optional(),
    traction: z.string().optional(),
    imageUrl: z.string().optional(),
  }),
  z.object({
    type: z.literal("product"),
    title: z.string(),
    imageUrl: z.string(),
    traction: z.string().optional(),
  }),
]);

export type CardData = z.infer<typeof cardSchema>;

// Mocking table structure for DynamoDB types
export const users = {
  id: "id",
  email: "email",
  password: "password",
  name: "name",
  role: "role",
  bio: "bio",
  instagram: "instagram",
  linkedin: "linkedin",
  whatsapp: "whatsapp",
  website: "website",
  uniqueSlug: "uniqueSlug",
  industry: "industry",
  cards: "cards",
  createdAt: "createdAt"
};

export type User = {
  id: string;
  email: string;
  password: string;
  name: string | null;
  role: string | null;
  bio: string | null;
  industry: string | null;
  instagram: string | null;
  linkedin: string | null;
  whatsapp: string | null;
  website: string | null;
  uniqueSlug: string | null;
  pin: string | null;
  reachCount: number; // Total number of scans/views
  instaClicks: number;
  linkedinClicks: number;
  whatsappClicks: number;
  websiteClicks: number;
  reachHistory: { timestamp: string; count: number }[]; // every 12h for last 7 days
  connections: { slug: string; connectedAt: string }[]; // array of uniqueSlugs with timestamp
  cards: string[]; // JSON strings
  notes: { id: string; text: string; completed: boolean; expiresAt: string }[];
  createdAt: Date;
};

export const insertUserSchema = z.object({
  email: z.string().email().optional().or(z.string().length(0)),
  password: z.string().min(1).optional().or(z.string().length(0)),
  name: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  cards: z.array(z.string()).optional(),
  connections: z.array(z.object({
    slug: z.string(),
    connectedAt: z.string()
  })).optional(),
  notes: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
    expiresAt: z.string(),
  })).optional(),
  uniqueSlug: z.string().optional().nullable(),
  pin: z.string().length(5).optional().nullable(),
  reachCount: z.number().optional(),
  instaClicks: z.number().optional(),
  linkedinClicks: z.number().optional(),
  whatsappClicks: z.number().optional(),
  portalClicks: z.number().optional(),
  reachHistory: z.array(z.object({
    date: z.string(),
    count: z.number()
  })).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;


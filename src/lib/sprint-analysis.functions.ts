import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AnswersSchema = z.object({
  profile: z.string().optional(),
  duration: z.string().optional(),
  appsPerWeek: z.string().optional(),
  interviews: z.string().optional(),
  challenges: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  location: z.string().optional(),
  salary: z.number().default(25000),
  commitment: z.number().default(8),
  goals: z.array(z.string()).default([]),
});

const AnalysisSchema = z.object({
  headline: z.string().describe("A concise, encouraging 6-10 word headline about the user's profile."),
  strengths: z.array(z.string()).describe("2-3 short strength statements (max 12 words each)."),
  focusAreas: z.array(z.string()).describe("3 short priority focus areas (max 12 words each)."),
  weeklyTarget: z.string().describe("A concrete weekly application/action target, 1 sentence."),
  outlook: z.string().describe("A 1-sentence encouraging outlook tailored to South Africa's market."),
});

export type SprintAnalysis = z.infer<typeof AnalysisSchema>;

export const generateSprintAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnswersSchema.parse(input))
  .handler(async ({ data }): Promise<SprintAnalysis> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Graceful fallback so onboarding never blocks on missing infra.
      return fallback(data);
    }
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const { experimental_output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        experimental_output: Output.object({ schema: AnalysisSchema }),
        prompt: buildPrompt(data),
      });
      return experimental_output;
    } catch (err) {
      console.error("[sprint-analysis] gateway error", err);
      return fallback(data);
    }
  });

function buildPrompt(a: z.infer<typeof AnswersSchema>) {
  return [
    "You are a career coach for The 90-Day Job Search Sprint, tailored to South African job seekers.",
    "Analyse the user's onboarding answers and produce a short, personalised, encouraging assessment.",
    "Be specific to their profile, industries and challenges. Use plain English. No emojis. No markdown.",
    "",
    "USER ANSWERS:",
    `- Profile type: ${a.profile ?? "unspecified"}`,
    `- Time searching: ${a.duration ?? "unspecified"}`,
    `- Applications per week: ${a.appsPerWeek ?? "unspecified"}`,
    `- Interviews secured recently: ${a.interviews ?? "unspecified"}`,
    `- Top challenges: ${a.challenges.join(", ") || "none listed"}`,
    `- Target industries: ${a.industries.join(", ") || "none listed"}`,
    `- Location preference: ${a.location ?? "unspecified"}`,
    `- Target monthly salary (ZAR): R${a.salary.toLocaleString()}`,
    `- Commitment (1-10): ${a.commitment}`,
    `- 90-day goals: ${a.goals.join(", ") || "none listed"}`,
  ].join("\n");
}

function fallback(a: z.infer<typeof AnswersSchema>): SprintAnalysis {
  const industry = a.industries[0] ?? "your target sector";
  return {
    headline: "Your Sprint plan is ready to launch",
    strengths: [
      `Clear focus on ${industry}`,
      `Commitment level of ${a.commitment}/10 signals real momentum`,
    ],
    focusAreas: [
      "Rebuild your CV around measurable outcomes",
      "Increase weekly application volume with quality templates",
      "Add structured interview practice from week 2",
    ],
    weeklyTarget: "Aim for 15 tailored applications per week with recruiter follow-ups.",
    outlook: "With structure and consistency, meaningful traction in South Africa's market is achievable within 6-8 weeks.",
  };
}

import { createFileRoute } from "@tanstack/react-router";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jobbyist — The 90-Day Job Search Sprint" },
      { name: "description", content: "A structured, AI-enhanced 90-day job search programme designed for South Africa's competitive labour market." },
      { property: "og:title", content: "Jobbyist — The 90-Day Job Search Sprint" },
      { property: "og:description", content: "Personalised onboarding. Build your sprint in minutes." },
    ],
  }),
  component: Index,
});

function Index() {
  return <Onboarding />;
}

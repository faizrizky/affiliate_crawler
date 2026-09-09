import { Eye, FileText, PenLine, Radar, Search } from "lucide-react";

const STEPS = [
  {
    icon: Search,
    title: "Search a topic",
    desc: "Type the topic you want to research on Threads.",
  },
  {
    icon: Radar,
    title: "Crawl runs async",
    desc: "We fetch live posts in the background while you wait.",
  },
  {
    icon: Eye,
    title: "Review the posts",
    desc: "Scan relevance and affiliate scores in one place.",
  },
  {
    icon: FileText,
    title: "Pick a template",
    desc: "Choose the structure your affiliate copy should follow.",
  },
  {
    icon: PenLine,
    title: "Save ready copy",
    desc: "Apply the template and copy publish-ready text.",
  },
];

export function HowItWorks() {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">How it works</h2>
      <ol className="mt-4 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
              <step.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              Step {i + 1}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{step.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

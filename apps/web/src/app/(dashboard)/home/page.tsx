import type { Metadata } from "next";
import { HowItWorks } from "@/home/how-it-works";
import { RecentTopics } from "@/home/recent-topics";
import { SearchSection } from "@/home/search-section";
import { Drafts } from "@/home/drafts";
import { GenerateDialog } from "@/home/generate-dialog";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Turn real Threads conversations into affiliate copy
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Search a topic, review the Threads posts that matter, apply a
          template, and save publish-ready copy.
        </p>
      </section>
      <SearchSection />
      <Drafts />
      <RecentTopics />
      <HowItWorks />
      <GenerateDialog />
    </div>
  );
}

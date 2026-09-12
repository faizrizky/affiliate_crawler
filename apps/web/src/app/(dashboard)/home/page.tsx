import type { Metadata } from "next";
import { RecentTopics } from "@/home/recent-topics";
import { SearchSection } from "@/home/search-section";
import { Drafts } from "@/home/drafts";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="hidden md:block">
        <p className="text-sm font-semibold">Hey Folks!</p>
        <h1 className="text-3xl font-bold tracking-tight">What&apos;s Up</h1>
      </section>
      <SearchSection />
      <Drafts />
      <RecentTopics />
    </div>
  );
}

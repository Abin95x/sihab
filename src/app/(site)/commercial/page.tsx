import type { Metadata } from "next";
import { StoryList } from "@/components/story-list";
import { getStories } from "@/lib/data";

export const metadata: Metadata = { title: "Commercial" };

export default async function CommercialPage() {
  const stories = await getStories("commercial");
  return <StoryList title="Commercial" stories={stories} />;
}

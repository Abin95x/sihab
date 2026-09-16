import type { Metadata } from "next";
import { StoryList } from "@/components/story-list";
import { getStories } from "@/lib/data";

export const metadata: Metadata = { title: "Editorial" };

export default async function EditorialPage() {
  const stories = await getStories("editorial");
  return <StoryList title="Editorial" stories={stories} />;
}

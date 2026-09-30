import type { Metadata } from "next";
import { StoryList } from "@/components/story-list";
import { getStories } from "@/lib/data";
import { readSearch } from "@/lib/validation";

export const metadata: Metadata = { title: "Commercial" };

export default async function CommercialPage({ searchParams }: PageProps<"/commercial">) {
  const search = readSearch((await searchParams).q);
  // Only the first few stories are rendered here; the list loads the rest as the visitor scrolls.
  const first = await getStories("commercial", 0, search);
  return <StoryList title="Commercial" section="commercial" search={search} first={first} />;
}

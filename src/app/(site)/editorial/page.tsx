import type { Metadata } from "next";
import { StoryList } from "@/components/story-list";
import { getStories } from "@/lib/data";
import { readSearch } from "@/lib/validation";

export const metadata: Metadata = { title: "Editorial" };

export default async function EditorialPage({ searchParams }: PageProps<"/editorial">) {
  const search = readSearch((await searchParams).q);
  // Only the first few stories are rendered here; the list loads the rest as the visitor scrolls.
  const first = await getStories("editorial", 0, search);
  return <StoryList title="Editorial" section="editorial" search={search} first={first} />;
}

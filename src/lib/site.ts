// Site-wide copy and links. Edit these to change what visitors see.
export const site = {
  name: "SIHAB",
  title: "Sihab — Photographer",
  description: "Editorial and commercial photography by Sihab.",
  email: "hello@sihab.com",
  instagram: "https://www.instagram.com/sihabjango/",
  bio: "Sihab is a photographer working across editorial, commercial and personal projects. The work leans toward quiet light, worn textures and the small unguarded moments between frames — portraits that feel observed rather than staged. Available for commissions and collaborations worldwide.",
} as const;

export const navItems = [
  { href: "/", label: "Homepage" },
  { href: "/editorial", label: "Editorial" },
  { href: "/commercial", label: "Commercial" },
] as const;

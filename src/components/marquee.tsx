import { site } from "@/lib/site";

// Giant name scrolling behind the homepage. Four copies so the -50% loop is seamless on wide screens.
export function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i}>{site.name}</span>
        ))}
      </div>
    </div>
  );
}

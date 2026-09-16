import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-links">
        <a href={`mailto:${site.email}`} aria-label="Email" title="Email">
          <MailIcon />
        </a>
        <a href={site.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
          <InstagramIcon />
        </a>
      </p>
    </footer>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="1.5" />
      <path d="m3.25 6.25 8.75 6.5 8.75-6.5" strokeLinejoin="round" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.25" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

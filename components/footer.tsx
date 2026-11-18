import Link from "next/link";
import { FooterCmdKTrigger } from "./palette/footer-cmd-k-trigger";
import { site, contactLinks } from "@/lib/site";

const PAGES = [
  { href: "/", label: "Home" },
  { href: "/#ask", label: "Ask" },
  { href: "/#work", label: "Work" },
  { href: "/about", label: "About" },
];

export function Footer() {
  return (
    <footer id="footer" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-5 pb-12 pt-10 text-[13px] sm:grid-cols-[1fr_auto_auto] sm:gap-16 sm:px-8">
        <p className="max-w-[40ch] leading-relaxed text-muted">
          © {new Date().getFullYear()} {site.name}. {site.footerNote} <FooterCmdKTrigger /> for the good stuff.
        </p>
        <nav aria-label="Site">
          <ul className="space-y-2">
            {PAGES.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-fg-soft transition-colors hover:text-fg">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Elsewhere">
          <ul className="space-y-2">
            {contactLinks().map((l) => (
              <li key={l.id}>
                <a
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                  className="text-fg-soft transition-colors hover:text-fg"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

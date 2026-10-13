import { Button, Container } from "@/components/ui";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <section className="py-24 text-center">
      <Container>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">404</p>
        <h1 className="mt-3 text-5xl font-semibold">We could not find that page</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-muted">It may have moved or no longer exists.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button cta={{ label: "Back to home", href: "/" }} />
          <Button cta={{ label: "Contact us", href: "/contact", style: "secondary" }} />
        </div>
      </Container>
    </section>
  );
}

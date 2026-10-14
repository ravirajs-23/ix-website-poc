// TEMPORARY review aid: shows which reference site a page's layout was modelled on.
// Hide everywhere with NEXT_PUBLIC_HIDE_REFERENCE_TAG=true, or delete this file and its usages.
export function ReferenceTag({ reference }: { reference?: { name: string; url?: string } }) {
  if (!reference || process.env.NEXT_PUBLIC_HIDE_REFERENCE_TAG === "true") return null;
  const label = (
    <>
      <span className="font-semibold">Layout ref:</span> {reference.name}
    </>
  );
  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-[calc(100vw-2rem)] rounded-full bg-amber-300 px-4 py-2 text-xs text-ink shadow-lg">
      {reference.url ? (
        <a href={reference.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          {label}
        </a>
      ) : (
        label
      )}
    </div>
  );
}

// POC stub: validates the enquiry and logs it. Wire to email/CRM (e.g. Resend, HubSpot) before launch.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: pretend success for bots.
  if (typeof body.website === "string" && body.website.length > 0) {
    return Response.json({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.length < 5) {
    return Response.json({ error: "Please provide your name, a valid email and a message." }, { status: 400 });
  }

  console.log("[contact] enquiry", { name, email, company: String(body.company ?? ""), message: message.slice(0, 2000) });
  return Response.json({ ok: true });
}

import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";

// Strapi webhook target: Settings > Webhooks > add URL  /api/revalidate  with header
//   x-revalidate-secret: <REVALIDATE_SECRET>   for Entry publish / unpublish / update events.
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected ?? "");
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  revalidateTag("strapi", "max");
  return Response.json({ revalidated: true });
}

import { z } from "zod";
import { FUEL_CODES } from "@/lib/fuels";
import { PERIODS, stationSeries, zoneMedianSeries } from "@/lib/history";
import { currentUser } from "@/lib/session";

const Q = z.object({
  fuel: z.enum(FUEL_CODES as [string, ...string[]]),
  days: z.coerce.number().refine((d) => (PERIODS as readonly number[]).includes(d)).default(30),
});

export async function GET(req: Request, ctx: RouteContext<"/api/stations/[id]/history">) {
  if (!(await currentUser())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = Number((await ctx.params).id);
  const q = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!Number.isInteger(id) || !q.success) return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  const [station, zone] = await Promise.all([stationSeries(id, q.data.fuel, q.data.days), zoneMedianSeries(id, q.data.fuel, q.data.days)]);
  return Response.json({ station, zone }, { headers: { "Cache-Control": "private, max-age=300" } });
}

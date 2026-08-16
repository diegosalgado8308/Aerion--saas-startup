import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Polled by uptime monitors — sits outside the session-based auth gate in
 * proxy.js (see its matcher) since a monitor has no user cookie. Checks the
 * database with a trivial query rather than just returning 200 unconditionally:
 * the app is only actually "up" if it can reach Postgres, and Neon (unlike a
 * traditional always-on Postgres) can itself be unreachable independent of
 * whether the Next.js server is running.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Logged, not returned — this endpoint is public/unauthenticated, and a raw
    // DB error can contain connection details an anonymous caller shouldn't see.
    console.error("[health] database check failed:", err);
    return NextResponse.json(
      {
        status: "error",
        database: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

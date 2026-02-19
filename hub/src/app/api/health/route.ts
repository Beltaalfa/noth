import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Health check for load balancer / monitoring.
 * Returns 200 if the app and DB are reachable; no sensitive data.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ status: "unhealthy", db: "down" }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", db: "up" });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const count = await prisma.message.count({
    where: {
      direction: "in",
      OR: [{ classification: null }, { classification: { reviewedAt: null } }],
    },
  });
  return NextResponse.json({ count });
}

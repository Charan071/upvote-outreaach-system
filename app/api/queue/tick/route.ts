import { NextResponse } from "next/server";
import { tickQueue } from "@/lib/queue";

export async function POST() {
  try {
    const result = await tickQueue();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Queue failed" },
      { status: 500 },
    );
  }
}

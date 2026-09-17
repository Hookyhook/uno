import { NextResponse } from "next/server";
import { z } from "zod";
import { nameSchema } from "@/lib/protocol";
import { createRoomForPlayer, toErrorResponse } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { name } = z.object({ name: nameSchema }).parse(await req.json());
    return NextResponse.json(await createRoomForPlayer(name));
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

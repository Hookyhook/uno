import { NextResponse } from "next/server";
import { z } from "zod";
import { codeSchema, nameSchema } from "@/lib/protocol";
import { joinRoom, toErrorResponse } from "@/lib/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = codeSchema.parse((await params).code);
    const { name } = z.object({ name: nameSchema }).parse(await req.json());
    return NextResponse.json(await joinRoom(code, name));
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

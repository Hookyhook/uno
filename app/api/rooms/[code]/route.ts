import { NextResponse } from "next/server";
import { z } from "zod";
import { actionSchema } from "@/lib/protocol";
import { act, pollRoom, resolveSession, toErrorResponse } from "@/lib/service";
import { RoomError } from "@/lib/room";

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

async function sessionFrom(req: Request, code: string) {
  const token = req.headers.get("x-uno-token");
  if (!token) throw new RoomError("no_token", "Missing session token", 401);
  const session = await resolveSession(token);
  if (session.roomCode !== code) throw new RoomError("wrong_room", "That token belongs to another room", 403);
  return session;
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = await sessionFrom(req, (await params).code);
    return NextResponse.json(await pollRoom(session), noStore);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, ...noStore });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const session = await sessionFrom(req, (await params).code);
    const action = z.object({ action: actionSchema }).parse(await req.json()).action;
    const view = await act(session, action);
    return NextResponse.json(view ?? { left: true }, noStore);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, ...noStore });
  }
}

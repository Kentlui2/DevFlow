import { NextResponse } from "next/server";

export function apiError(message: string, code: string, status: number, issues?: unknown) {
  return NextResponse.json(
    { error: { message, code, ...(issues ? { issues } : {}) } },
    { status }
  );
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

import { handle } from "../route";

export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ slot: string }> }) {
  return handle(request, (await params).slot);
}

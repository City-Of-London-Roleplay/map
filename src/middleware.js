import { NextResponse } from "next/server";

export async function middleware(request) {
  const { searchParams } = new URL(request.url);
  const user = searchParams.get("user");

  if (user && user.endsWith(".png")) {
    const username = user.replace(/\.png$/i, "");
    return NextResponse.rewrite(
      new URL(`/api/user-image?user=${username}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/"
};

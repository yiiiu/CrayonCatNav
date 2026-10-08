import NextAuth from "next-auth";
import { type NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";
import { publishedSlugExists } from "@/lib/data/resource-exists";
import { isToolSlug } from "@/lib/tools/metas";
import { slugSchema } from "@/lib/validation/common";

const { auth } = NextAuth(authConfig);

/** 第一层防护：未登录访问 /admin/* 直接跳登录页；真正的权限判断在 requireAdmin()。 */
const adminGuard = auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (!req.auth?.user) {
    const url = new URL("/admin/login", req.nextUrl);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

/** 资源详情：不存在 / 未发布的 slug 在渲染前改写到 404 页，保证真实 404 状态码。 */
async function resourceGuard(req: NextRequest) {
  const slug = decodeURIComponent(req.nextUrl.pathname.slice("/resources/".length));
  const exists = slugSchema.safeParse(slug).success ? await publishedSlugExists(slug) : false;
  if (exists === false) {
    // 目标与详情页 generateStaticParams 里的 NOT_FOUND_SLUG 保持一致
    return NextResponse.rewrite(new URL("/resources/__none__", req.nextUrl), { status: 404 });
  }
  return NextResponse.next();
}

/** 工具页：注册表外的 slug 改写到预渲染的 404 占位（与 tools/[slug] 的 NOT_FOUND_SLUG 一致）。 */
function toolGuard(req: NextRequest) {
  const slug = decodeURIComponent(req.nextUrl.pathname.slice("/tools/".length));
  if (slug === "__none__" || !isToolSlug(slug)) {
    return NextResponse.rewrite(new URL("/tools/__none__", req.nextUrl), { status: 404 });
  }
  return NextResponse.next();
}

export async function proxy(req: NextRequest, ev: Parameters<typeof adminGuard>[1]) {
  if (req.nextUrl.pathname.startsWith("/resources/")) return resourceGuard(req);
  if (req.nextUrl.pathname.startsWith("/tools/")) return toolGuard(req);
  return adminGuard(req, ev);
}

export const config = { matcher: ["/admin/:path*", "/resources/:slug", "/tools/:slug"] };

import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/data/prisma";
import { auth } from "./auth";

/**
 * 管理端唯一鉴权入口：每个后台 server action / route handler / 受保护布局首行调用。
 * 会话有效之外再查一次 Admin 表（二次校验），被删除的管理员立即失效。
 */
export async function requireAdmin() {
  const session = await auth();
  const adminId = session?.user?.id;
  if (!adminId) redirect("/admin/login");
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { id: true, email: true, role: true } });
  if (!admin) redirect("/admin/login?error=denied");
  return admin;
}

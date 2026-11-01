"use client";

import { useEffect, useRef, useState } from "react";
import { Mono } from "@/components/ui";
import { logoCandidates } from "@/lib/resource/display";
import styles from "./resource.module.css";

const LOAD_TIMEOUT_MS = 4000;

type Props = {
  name: string;
  accentKey: string;
  iconUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  size?: "md" | "lg";
};

/** 资源 Logo：依次尝试图标 / GitHub 头像 / favicon，加载失败或太小就换下一个，全失败回退首字母色块。 */
export function ResourceLogo({ name, accentKey, size = "md", ...urls }: Props) {
  const candidates = logoCandidates(urls);
  const [i, setI] = useState(0);
  const src = candidates[i];
  const img = useRef<HTMLImageElement>(null);
  // 服务端渲染的图片可能在水合前就加载失败，onError 收不到，水合后补查一次；
  // 4 秒还没加载出来（如国内访问 GitHub 卡住）也换下一个
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    if (el.complete) {
      if (el.naturalWidth < 8) setI((n) => n + 1);
      return;
    }
    const t = setTimeout(() => {
      if (!el.complete || el.naturalWidth < 8) setI((n) => n + 1);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [src]);
  if (!src) return <Mono name={name} accentKey={accentKey} size={size} />;
  return (
    <span className={`${styles.logo} ${size === "lg" ? styles.logoLg : ""}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- 外站图标，不走 next/image 优化 */}
      <img
        key={src}
        ref={img}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setI((n) => n + 1)}
        onLoad={(e) => {
          // 1×1 透明像素等占位图视为失败
          if (e.currentTarget.naturalWidth < 8) setI((n) => n + 1);
        }}
      />
    </span>
  );
}

const palette = ["var(--c-blue)", "var(--c-magenta)", "var(--c-purple)", "var(--c-green)", "var(--c-orange)", "var(--c-yellow)"];

/** 由字符串稳定映射到一种蜡笔色。 */
export function accentFor(key: string) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** 资源头像缩写：英文取前两个单词首字母（单词则取前两位），中文取首字。 */
export function monogram(name: string) {
  const words = name.match(/[A-Za-z0-9]+/g);
  if (words && words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words && words[0]) return words[0].slice(0, 2).replace(/^./, (c) => c.toUpperCase());
  return [...name.trim()][0] ?? "?";
}

/** 外链展示用的域名。 */
export function hostOf(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

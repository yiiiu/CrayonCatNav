import styles from "./SearchBox.module.css";

type Props = {
  action?: string;
  defaultValue?: string;
  placeholder?: string;
  /** 需要随搜索一起保留的其他条件（如 cat、tag） */
  hidden?: Record<string, string | undefined>;
  className?: string;
};

/** GET 表单搜索框：URL 即状态，无需客户端 JS。 */
export function SearchBox({ action = "/resources", defaultValue, placeholder = "搜索 MCP、Agent、模型…", hidden, className }: Props) {
  return (
    <form action={action} role="search" className={className}>
      <label className={styles.srch}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </svg>
        <span className="sr-only">搜索资源</span>
        <input type="search" name="q" defaultValue={defaultValue} placeholder={placeholder} maxLength={50} />
        {hidden &&
          Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      </label>
    </form>
  );
}

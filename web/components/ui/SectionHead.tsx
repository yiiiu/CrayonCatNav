export function SectionHead({ title, note, id }: { title: string; note?: string; id?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "46px 0 4px" }}>
      <h2 id={id} style={{ margin: 0, fontSize: "var(--fs-xl)", fontWeight: 900, letterSpacing: 1 }}>
        {title}
      </h2>
      {note ? <small style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--ink-2)" }}>{note}</small> : null}
    </div>
  );
}

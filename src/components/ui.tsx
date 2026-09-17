import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return (
    <motion.section
      className="glass cyan-outline grid gap-4 p-6"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-tinan-cyan">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/72">{description}</p>
      </div>
      {children}
    </motion.section>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="glass p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mt-2 text-sm text-white/72">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="glass p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-tinan-cyan">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white break-all">{value}</p>
      {detail ? <p className="mt-2 text-sm text-white/62">{detail}</p> : null}
    </article>
  );
}

export function KeyValueList({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-3">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <dt className="text-sm text-white/52">{row.label}</dt>
          <dd className="mt-1 break-all text-sm font-medium text-white">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkButton({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return <span className="rounded-xl border border-dashed border-white/15 px-4 py-2 text-sm text-white/45">{label} unavailable</span>;
  }
  return (
    <a className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/50 hover:text-tinan-cyan" href={href} rel="noreferrer" target="_blank">
      {label}
    </a>
  );
}

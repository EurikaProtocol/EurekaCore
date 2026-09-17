import { useEffect, useState } from "react";
import { EKA_TOKEN } from "../config/token";
import { getEkaContractExplorerUrl } from "../sdk/evm";

const WHITEPAPER_PATH = "/whitepaper/EUREKA_CHAIN_Whitepaper_v2.pdf";
const GITHUB_URL = "https://github.com/EurikaProtocol/EurekaCore";
const PAGE_TITLE = "EUREKA CHAIN Whitepaper";
const PAGE_DESCRIPTION = "Universal Tokenization Network built for data, AI and programmable digital assets.";
const TAGLINE = "“If it can be verified, it can be tokenized.”";
const EXPLORER_URL = getEkaContractExplorerUrl();

const FEATURES = [
  "Proof-of-Data",
  "Proof-of-Action",
  "Proof-of-Device",
  "Data Vault",
  "AI Economy",
  "Multichain",
] as const;

export default function Whitepaper() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    const previousDescription = getMetaContent('meta[name="description"]');
    document.title = PAGE_TITLE;
    setMetaTag("description", PAGE_DESCRIPTION, "name");
    return () => {
      document.title = previousTitle;
      restoreMetaTag("description", previousDescription, "name");
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyContract() {
    await navigator.clipboard.writeText(EKA_TOKEN.contractAddress);
    setCopied(true);
  }

  return (
    <div className="grid gap-6 text-white">
      <section className="overflow-hidden rounded-[2rem] border border-[#00D9FF]/15 bg-[#05070A] shadow-[0_32px_80px_rgba(0,0,0,0.4)]">
        <div className="relative px-6 py-10 sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,217,255,0.22),transparent_34%),radial-gradient(circle_at_right,rgba(24,255,255,0.12),transparent_28%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-[#18FFFF]/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.32em] text-[#18FFFF]">
                <img alt="EUREKA logo" className="h-6 w-6 rounded-full bg-white/5 p-1" src="/logo.svg" />
                Whitepaper v2.0
              </div>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">EUREKA CHAIN</h2>
              <p className="mt-3 text-lg text-[#BDFBFF]">Universal Tokenization Network</p>
              <p className="mt-4 max-w-2xl text-base text-white/72">{TAGLINE}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="rounded-2xl bg-[#00D9FF] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#18FFFF]" href="#whitepaper-viewer">Read Whitepaper</a>
                <a className="rounded-2xl border border-[#18FFFF]/35 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#18FFFF] hover:bg-white/10" download href={WHITEPAPER_PATH}>Download PDF</a>
                <a className="rounded-2xl border border-white/15 bg-black/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#00D9FF]/50 hover:bg-white/10" href={GITHUB_URL} rel="noreferrer" target="_blank">View GitHub</a>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-6 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#18FFFF]">Official release</p>
                  <p className="mt-2 text-2xl font-semibold text-white">EUREKA_CHAIN_Whitepaper_v2.pdf</p>
                </div>
                <img alt="TinanEureka logo mark" className="h-16 w-16 rounded-2xl border border-white/10 bg-black/30 p-2" src="/logo.svg" />
              </div>
              <dl className="mt-5 grid gap-3 text-sm text-white/75">
                <InfoRow label="Project" value="EUREKA Protocol" />
                <InfoRow label="Website" value="tinaneureka.com" />
                <InfoRow label="AI" value="TinanAI" />
                <InfoRow label="Native EVM token" value="EKA" />
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FEATURES.map((title) => (
          <article key={title} className="group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#18FFFF]/35 hover:bg-white/[0.06]">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/68">Protocol capability highlighted in the official whitepaper.</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <section id="whitepaper-viewer" className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#05070A] shadow-[0_20px_48px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#18FFFF]">Read online</p>
              <h3 className="mt-1 text-xl font-semibold text-white">Embedded PDF viewer</h3>
            </div>
            <a className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-[#18FFFF]/40 hover:bg-white/10" download href={WHITEPAPER_PATH}>Download PDF</a>
          </div>
          <object className="h-[72vh] min-h-[540px] w-full bg-[#0A0F16] md:h-[84vh]" data={WHITEPAPER_PATH} type="application/pdf">
            <div className="flex h-full min-h-[540px] flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="max-w-md text-sm text-white/72">Your browser cannot render the embedded PDF. Use the download action to open the official whitepaper directly.</p>
              <a className="rounded-2xl bg-[#00D9FF] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#18FFFF]" download href={WHITEPAPER_PATH}>Download PDF</a>
            </div>
          </object>
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[#18FFFF]">Token information</p>
            <div className="mt-4 space-y-4 text-sm text-white/78">
              <TokenRow label="Token" value={EKA_TOKEN.symbol} />
              <TokenRow label="Network" value={EKA_TOKEN.networkLabel} />
              <TokenRow label="Contract" value={EKA_TOKEN.contractAddress} breakAll />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-xl bg-[#00D9FF] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#18FFFF]" onClick={() => copyContract().catch(() => undefined)} type="button">{copied ? "Copied" : "Copy Contract"}</button>
              {EXPLORER_URL ? <a className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-[#18FFFF]/40 hover:bg-white/10" href={EXPLORER_URL} rel="noreferrer" target="_blank">View on Explorer</a> : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <dt className="text-white/55">{label}</dt>
      <dd className="text-right font-medium text-white">{value}</dd>
    </div>
  );
}

function TokenRow({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-white/55">{label}</p>
      <p className={`mt-1 font-medium text-white ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

function getMetaContent(selector: string) {
  return document.head.querySelector<HTMLMetaElement>(selector)?.content ?? null;
}

function setMetaTag(key: string, content: string, attribute: "name" | "property") {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function restoreMetaTag(key: string, content: string | null, attribute: "name" | "property") {
  const tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) return;
  if (content === null) {
    tag.remove();
    return;
  }
  tag.content = content;
}

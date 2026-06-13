import { useEffect, useMemo, useState, useCallback } from "react";
import logo from "@/assets/collectible-logo.svg";
import {
  ensureParticipant,
  linkWallet,
  markSubstackOpened,
  getStats,
  mintPhase1,
} from "@/lib/mint";

const SUBSTACK_URL = "https://collectiblle.substack.com/publish/posts";
const BRAND_BLUE = "#1a43d4";
const REQUIRED_REFERRALS = 2;

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
      on?: (event: string, handler: (...args: any[]) => void) => void;
      removeListener?: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function Landing() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletErr, setWalletErr] = useState<string | null>(null);
  const [readSubstack, setReadSubstack] = useState(false);
  const [minted, setMinted] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [myCode, setMyCode] = useState<string>("");
  const [referrals, setReferrals] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (code: string) => {
    try {
      const stats = await getStats({ code });
      setReferrals(stats.referrals);
      if (stats.me?.substack_opened) setReadSubstack(true);
      if (stats.me?.minted) setMinted(true);
      if (stats.me?.wallet) setWallet(stats.me.wallet);
    } catch {
      // best-effort
    }
  }, []);

  // Bootstrap: create/load participant, register referral if present
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = localStorage.getItem("mint:myCode") ?? undefined;
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") ?? undefined;
      try {
        const me = await ensureParticipant({ code: existing, ref });
        if (cancelled || !me) return;
        localStorage.setItem("mint:myCode", me.code);
        setMyCode(me.code);
        if (me.wallet) setWallet(me.wallet);
        if (me.substack_opened) setReadSubstack(true);
        if (me.minted) setMinted(true);
        refresh(me.code);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Silent wallet pickup
  useEffect(() => {
    if (wallet || !window.ethereum || !myCode) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accs) => {
        if (accs && accs[0]) {
          setWallet(accs[0]);
          await linkWallet({ code: myCode, wallet: accs[0] });
        }
      })
      .catch(() => {});
  }, [wallet, myCode]);

  const hasReferrals = referrals >= REQUIRED_REFERRALS;
  const canMint = !!wallet && readSubstack && hasReferrals && !minting && !minted;

  const referralLink = useMemo(() => {
    if (!myCode) return "";
    return `${window.location.origin}/?ref=${myCode}`;
  }, [myCode]);

  async function copyReferral() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  async function connectWallet() {
    setWalletErr(null);

    if (!window.ethereum) {
      // On mobile, suggest using MetaMask Mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // Deep link to MetaMask Mobile
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
        return;
      }
      setWalletErr(
        "No wallet detected. Install MetaMask or another EVM wallet to continue.",
      );
      return;
    }

    try {
      const accs = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accs && accs[0]) {
        setWallet(accs[0]);
        if (myCode) {
          await linkWallet({ code: myCode, wallet: accs[0] });
        }
      }
    } catch (e) {
      setWalletErr(
        e instanceof Error ? e.message : "Failed to connect wallet.",
      );
    }
  }

  async function openSubstack() {
    window.open(SUBSTACK_URL, "_blank", "noopener,noreferrer");
    setReadSubstack(true);
    if (myCode) {
      try {
        console.log("📤 Marking Substack as opened for code:", myCode);
        await markSubstackOpened({ code: myCode });
        console.log("✅ Substack opened marked successfully");
        refresh(myCode);
      } catch (err) {
        console.error("❌ Failed to mark Substack opened:", err);
      }
    }
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!canMint || !myCode || !wallet) return;
    setMintErr(null);
    setMinting(true);
    try {
      const res = await mintPhase1({ code: myCode, wallet });
      if (res.ok) setMinted(true);
    } catch (e) {
      setMintErr(e instanceof Error ? e.message : "Mint failed.");
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: BRAND_BLUE }}>
      <h2 className="sr-only">
        COllectible mint — buy resellable artworks directly from artists
      </h2>
      <section
        className="relative flex min-h-screen w-full flex-col overflow-hidden font-sans"
        style={{ backgroundColor: BRAND_BLUE }}
      >
        <div className="pointer-events-none absolute -right-[60px] -top-20 h-[300px] w-[300px] rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute -left-10 bottom-5 h-[180px] w-[180px] rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute right-[200px] top-[60px] h-[100px] w-[100px] rounded-full bg-white/[0.06]" />

        {/* Nav */}
        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10">
          <a
            href="/"
            className="inline-flex items-center gap-3"
            aria-label="COllectible home"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 shadow-sm">
              <img src={logo} alt="" className="h-full w-full object-contain p-1" />
            </span>
            <span className="text-[15px] font-semibold text-white">COllectible</span>
          </a>
          <div className="flex items-center gap-4 md:gap-7">
            <button
              type="button"
              onClick={openSubstack}
              className="hidden text-[13px] text-white/65 transition hover:text-white sm:inline"
            >
              Read the Substack
            </button>
            <button
              type="button"
              onClick={connectWallet}
              className="rounded-full bg-white px-[18px] py-[7px] text-[13px] font-medium"
              style={{ color: BRAND_BLUE }}
            >
              {wallet ? shortAddr(wallet) : "Connect wallet"}
            </button>
          </div>
        </nav>

        {/* Hero */}
        <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-10 px-6 py-12 md:grid-cols-2 md:px-10">
          <div>
            <h1 className="mb-6 font-sans text-[40px] font-bold leading-[1.04] tracking-normal text-white md:text-[56px]">
              Buy resellable
              <br />
              artworks <span style={{ color: "#8cbeff" }}>directly</span>
              <br />
              from artists
            </h1>
            <p className="mb-2 text-base leading-[1.65] text-white/65">
              Verified provenance. Transparent ownership.
              <br />
              Stronger resale value.
            </p>
            <p className="mb-8 max-w-xl text-[15px] leading-[1.65] text-white/40">
              COllectible is the provenance infrastructure for overlooked art
              markets, starting with Africa. Mint Phase 1 to get early access.
            </p>

            {minted ? (
              <div className="max-w-md rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur">
                <div className="text-lg font-semibold">Minted ✨</div>
                <p className="mt-1 text-sm text-white/65">
                  Phase 1 reserved for{" "}
                  <span className="text-white">
                    {wallet ? shortAddr(wallet) : "—"}
                  </span>
                  . Keep sharing your link — referrals still count.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleMint}
                className="max-w-md rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur"
              >
                {/* Step 1: Wallet */}
                <Step
                  n={1}
                  done={!!wallet}
                  title={
                    wallet
                      ? `Wallet connected · ${shortAddr(wallet)}`
                      : "Connect your wallet"
                  }
                  action={
                    !wallet && (
                      <button
                        type="button"
                        onClick={connectWallet}
                        className="rounded-full bg-white px-4 py-1.5 text-xs font-medium"
                        style={{ color: BRAND_BLUE }}
                      >
                        Connect
                      </button>
                    )
                  }
                />
                {walletErr && (
                  <div className="mt-1 text-[11px] text-red-200">{walletErr}</div>
                )}

                {/* Step 2: Substack */}
                <Step
                  n={2}
                  done={readSubstack}
                  title={readSubstack ? "Substack opened" : "Read the Substack"}
                  action={
                    !readSubstack && (
                      <button
                        type="button"
                        onClick={openSubstack}
                        className="rounded-full border border-white/30 px-4 py-1.5 text-xs text-white/80 hover:border-white hover:text-white"
                      >
                        Open ↗
                      </button>
                    )
                  }
                />

                {/* Step 3: Referrals */}
                <Step
                  n={3}
                  done={hasReferrals}
                  title={
                    hasReferrals
                      ? `Referrals complete · ${referrals}/${REQUIRED_REFERRALS}`
                      : `Refer ${REQUIRED_REFERRALS} friends · ${referrals}/${REQUIRED_REFERRALS}`
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => myCode && refresh(myCode)}
                      className="rounded-full border border-white/30 px-3 py-1.5 text-[11px] text-white/80 hover:border-white hover:text-white"
                      title="Refresh referral count"
                    >
                      Refresh
                    </button>
                  }
                />

                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="mb-1.5 text-[11px] uppercase tracking-[0.08em] text-white/50">
                    Your referral link
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={referralLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 truncate rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] text-white/90 outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyReferral}
                      className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold"
                      style={{ color: BRAND_BLUE }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-white/45">
                    A referral counts when your friend opens the Substack from
                    your link.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canMint}
                  className="mt-4 w-full rounded-full bg-white px-[22px] py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ color: BRAND_BLUE }}
                >
                  {minting ? "Minting…" : "Mint Phase 1"}
                </button>
                {mintErr && (
                  <div className="mt-2 text-[11px] text-red-200">{mintErr}</div>
                )}
                <p className="mt-3 text-[11px] text-white/45">
                  Connect a wallet, read the Substack, and refer{" "}
                  {REQUIRED_REFERRALS} friends to unlock instant mint.
                </p>
              </form>
            )}
          </div>

          <div className="hidden items-end justify-center md:flex">
            <svg
              width="320"
              height="335"
              viewBox="0 0 220 230"
              role="img"
              aria-labelledby="landing-art-title landing-art-desc"
            >
              <title id="landing-art-title">
                Floating artwork frame with provenance certificate
              </title>
              <desc id="landing-art-desc">
                An animated 3D-style artwork frame floating against the blue background
              </desc>
              <ellipse
                cx="110"
                cy="210"
                rx="65"
                ry="14"
                fill="rgba(0,0,0,0.18)"
                className="origin-center animate-pulse"
              />
              <g className="origin-center">
                <rect x="30" y="20" width="130" height="160" rx="6" fill="#1a2a6e" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
                <rect x="38" y="28" width="114" height="138" rx="4" fill="#0f1a50" />
                <rect x="44" y="34" width="102" height="126" rx="3" fill="#2a1a0e" />
                <ellipse cx="95" cy="72" rx="28" ry="34" fill="#8B4513" opacity="0.7" />
                <ellipse cx="95" cy="62" rx="18" ry="20" fill="#D2691E" />
                <circle cx="88" cy="56" r="3" fill="#1a0a00" />
                <circle cx="102" cy="56" r="3" fill="#1a0a00" />
                <path d="M88 65 Q95 70 102 65" stroke="#1a0a00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <ellipse cx="95" cy="108" rx="22" ry="26" fill="#8B4513" opacity="0.5" />
                <rect x="72" y="96" width="46" height="36" rx="2" fill="#D2691E" opacity="0.6" />
                <rect x="44" y="34" width="102" height="126" rx="3" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                <rect x="38" y="168" width="114" height="16" rx="2" fill="#c9a96e" />
                <rect x="42" y="169" width="106" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
                <rect x="38" y="182" width="114" height="4" rx="1" fill="#b8924a" />
              </g>
              <g transform="translate(140, 80)">
                <rect x="0" y="0" width="72" height="44" rx="8" fill="rgba(255,255,255,0.95)" />
                <circle cx="18" cy="14" r="8" fill={BRAND_BLUE} />
                <text x="18" y="18" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="700">OK</text>
                <rect x="30" y="8" width="34" height="3" rx="1" fill={BRAND_BLUE} opacity="0.7" />
                <rect x="30" y="14" width="24" height="2" rx="1" fill="#888" opacity="0.5" />
                <rect x="8" y="28" width="56" height="2" rx="1" fill="#eee" />
                <rect x="8" y="33" width="40" height="2" rx="1" fill="#eee" />
              </g>
            </svg>
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-10 border-t border-white/10">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap">
            {(
              [
                ["2,400+", "Artworks"],
                ["180+", "Artists"],
                ["100%", "Verified"],
                ["Africa-first", "Starting point"],
              ] as [string, string][]
            ).map(([value, label]) => (
              <div
                key={label}
                className="flex-1 border-r border-white/10 px-6 py-[1.1rem] last:border-r-0 md:px-8"
              >
                <div className="mb-0.5 text-lg font-medium text-white">{value}</div>
                <div className="text-[11px] uppercase tracking-[0.05em] text-white/40">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({
  n,
  done,
  title,
  action,
}: {
  n: number;
  done: boolean;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
            done ? "bg-white" : "bg-white/15 text-white"
          }`}
          style={done ? { color: "#1a43d4" } : undefined}
        >
          {done ? "✓" : n}
        </span>
        <span className="text-sm text-white">{title}</span>
      </div>
      {action}
    </div>
  );
}

import { useEffect, useState } from "react";
import { listDashboard, type DashboardRow } from "@/lib/mint";

const BRAND_BLUE = "#1a43d4";
const REQUIRED_REFERRALS = 2;

function shortAddr(a?: string | null) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function Dashboard() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [myCode, setMyCode] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await listDashboard();
      setRows(
        [...data].sort((a, b) => {
          if (b.referrals !== a.referrals) return b.referrals - a.referrals;
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMyCode(localStorage.getItem("mint:myCode") || "");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCodes = rows.length;
  const totalReferrals = rows.reduce((s, r) => s + r.referrals, 0);
  const unlockedCount = rows.filter((r) => r.referrals >= REQUIRED_REFERRALS).length;
  const mintedCount = rows.filter((r) => r.minted).length;

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: BRAND_BLUE }}>
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Referral Dashboard</h1>
            <p className="mt-1 text-sm text-white/60">
              Live participants, referral counts, and mint status.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="rounded-full border border-white/30 px-4 py-2 text-xs text-white/80 hover:border-white hover:text-white"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            <a
              href="/"
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold"
              style={{ color: BRAND_BLUE }}
            >
              ← Back
            </a>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Participants" value={totalCodes} />
          <Stat label="Credited referrals" value={totalReferrals} />
          <Stat label="Unlocked" value={unlockedCount} />
          <Stat label="Minted" value={mintedCount} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.06] text-[11px] uppercase tracking-[0.08em] text-white/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Referrals</th>
                <th className="px-4 py-3">Substack</th>
                <th className="px-4 py-3">Unlocked</th>
                <th className="px-4 py-3">Minted</th>
                <th className="px-4 py-3">Wallet</th>
                <th className="px-4 py-3">Referred by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-white/50"
                  >
                    {loading ? "Loading…" : "No participants yet."}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const isMe = r.code === myCode;
                const unlocked = r.referrals >= REQUIRED_REFERRALS;
                return (
                  <tr
                    key={r.code}
                    className="border-t border-white/10 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3 font-mono">
                      {r.code}
                      {isMe && (
                        <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/80">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.referrals}/{REQUIRED_REFERRALS}
                    </td>
                    <td className="px-4 py-3">
                      {r.substack_opened ? (
                        <span className="text-emerald-200">✓</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {unlocked ? (
                        <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] text-emerald-200">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="text-white/40">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.minted ? (
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] text-white">
                          Minted
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/80">
                      {shortAddr(r.wallet)}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">
                      {r.referred_by || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {myCode && (
          <p className="mt-4 text-xs text-white/60">
            Your code:{" "}
            <span className="font-mono text-white">{myCode}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-white/50">
        {label}
      </div>
    </div>
  );
}

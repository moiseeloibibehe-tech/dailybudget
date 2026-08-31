import React, { useState, useMemo, useEffect } from "react";
import {
  Coffee, ShoppingBag, ShoppingBag as ShoppingBagIcon, Home, Utensils, Heart, Gift, MoreHorizontal,
  Plus, TrendingUp, Wallet, PieChart as PieIcon, Settings,
  X, ArrowUpRight, ArrowDownRight, Zap, Smartphone, GraduationCap, Bus, LogOut, Loader2
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, ResponsiveContainer as RC2 } from "recharts";
import { supabase } from "./lib/supabase";
import AuthScreen from "./components/AuthScreen";
import {
  fetchTransactions, addTransaction, subscribeToTransactions,
  fetchMonthlyBudget, saveMonthlyBudget,
} from "./services/transactions";

// ---------- Design tokens ----------
const C = {
  bg: "#130D28",
  bg2: "#1B1338",
  surface: "#211A42",
  surface2: "#2A2151",
  line: "#352B5E",
  text: "#F5F2FC",
  muted: "#9A90C2",
  mutedSoft: "#6E6396",
  incomeA: "#7C5CFC",
  incomeB: "#4E8BFF",
  expenseA: "#FF7A5C",
  expenseB: "#FF4D8D",
  mint: "#2FE6C1",
  amber: "#FFB84D",
};

const CATEGORIES = {
  expense: [
    { id: "food", label: "Repas", icon: Utensils, color: "#FF7A5C" },
    { id: "transport", label: "Transport", icon: Bus, color: "#FFB84D" },
    { id: "shopping", label: "Achats", icon: ShoppingBag, color: "#FF4D8D" },
    { id: "home", label: "Maison", icon: Home, color: "#9B6BFF" },
    { id: "sante", label: "Santé", icon: Heart, color: "#FF6B9E" },
    { id: "loisirs", label: "Café/Loisirs", icon: Coffee, color: "#E8A34D" },
    { id: "telecom", label: "Télécom", icon: Smartphone, color: "#4EC9FF" },
    { id: "etudes", label: "Études", icon: GraduationCap, color: "#6BCB77" },
    { id: "autre", label: "Autre", icon: MoreHorizontal, color: "#8A80B8" },
  ],
  income: [
    { id: "salaire", label: "Salaire", icon: Wallet, color: "#4E8BFF" },
    { id: "cadeau", label: "Cadeau", icon: Gift, color: "#7C5CFC" },
    { id: "vente", label: "Vente", icon: TrendingUp, color: "#2FE6C1" },
    { id: "autre_r", label: "Autre", icon: MoreHorizontal, color: "#8A80B8" },
  ],
};

const catLookup = (id, type) =>
  CATEGORIES[type].find((c) => c.id === id) || CATEGORIES[type][0];

const fmt = (n) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.round(n)
  ) + " F";

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysInMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function inPeriod(dateStr, period) {
  if (period === "day") return dateStr === todayISO();
  if (period === "week") return dateStr >= startOfWeekISO();
  return dateStr >= startOfMonthISO(); // month
}

const LAST7 = Array.from({ length: 7 }, (_, i) => daysAgoISO(6 - i));
const DAY_LABEL = { 0: "D", 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S" };



const STORAGE_KEY = "dailybudget.transactions.v1";

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return SEED;
}

// ---------- Ring gauge ----------
function BudgetRing({ pct, size = 208 }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(animPct, 0), 100);
  const offset = circ - (clamped / 100) * circ;
  const over = pct > 100;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={over ? C.expenseA : C.incomeA} />
          <stop offset="100%" stopColor={over ? C.expenseB : C.incomeB} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.surface2} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.34,1.56,.64,1)" }}
      />
    </svg>
  );
}

// ---------- Bottom sheet: Add transaction ----------
function AddSheet({ open, onClose, onSave }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES.expense[0].id);
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) setVisible(true);
    else {
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setCategory(CATEGORIES[type][0].id), [type]);

  if (!visible) return null;

  const handleSave = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    onSave({ id: Date.now(), type, category, amount: val, note: note.trim(), date: todayISO() });
    setAmount("");
    setNote("");
    onClose();
  };

  const pad = (k) => {
    if (k === "back") return setAmount((a) => a.slice(0, -1));
    if (k === ".") {
      if (amount.includes(".")) return;
      return setAmount((a) => (a === "" ? "0." : a + "."));
    }
    setAmount((a) => (a === "0" ? k : a + k));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(8,5,20,0.6)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-3xl p-5 pb-8"
        style={{
          background: C.bg2, borderTop: `1px solid ${C.line}`,
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(.34,1.2,.4,1)",
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.line }} />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: C.text, fontFamily: "Outfit, sans-serif" }}>Nouvelle transaction</h2>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ background: C.surface }}>
            <X size={16} color={C.muted} />
          </button>
        </div>

        <div className="flex rounded-2xl p-1 mb-4" style={{ background: C.surface }}>
          {["expense", "income"].map((t) => (
            <button
              key={t} onClick={() => setType(t)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: type === t
                  ? t === "expense" ? `linear-gradient(135deg, ${C.expenseA}, ${C.expenseB})` : `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})`
                  : "transparent",
                color: type === t ? "#fff" : C.muted,
              }}
            >
              {t === "expense" ? "Dépense" : "Revenu"}
            </button>
          ))}
        </div>

        <div className="text-center mb-4">
          <div className="text-4xl font-bold tabular-nums" style={{ color: amount ? C.text : C.mutedSoft, fontFamily: "Outfit, sans-serif" }}>
            {amount ? fmt(parseFloat(amount) || 0) : "0 F"}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {CATEGORIES[type].map((c) => {
            const Icon = c.icon;
            const active = category === c.id;
            return (
              <button
                key={c.id} onClick={() => setCategory(c.id)}
                className="flex flex-col items-center gap-1 py-2 rounded-2xl transition-all"
                style={{ background: active ? `${c.color}2A` : "transparent", border: `1px solid ${active ? c.color : "transparent"}` }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${c.color}33` }}>
                  <Icon size={15} color={c.color} />
                </div>
                <span className="text-[10px] leading-tight text-center" style={{ color: C.muted }}>{c.label}</span>
              </button>
            );
          })}
        </div>

        <input
          value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)"
          className="w-full mb-4 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}
        />

        <div className="grid grid-cols-3 gap-2 mb-4">
          {["1","2","3","4","5","6","7","8","9",".","0","back"].map((k) => (
            <button key={k} onClick={() => pad(k)} className="py-3 rounded-xl text-lg font-medium" style={{ background: C.surface, color: C.text }}>
              {k === "back" ? "⌫" : k}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0}
          className="w-full py-3.5 rounded-2xl font-semibold text-white"
          style={{
            background: !amount || parseFloat(amount) <= 0 ? C.surface2 : type === "expense" ? `linear-gradient(135deg, ${C.expenseA}, ${C.expenseB})` : `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})`,
            opacity: !amount || parseFloat(amount) <= 0 ? 0.5 : 1,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function TxRow({ tx }) {
  const cat = catLookup(tx.category, tx.type);
  const Icon = cat.icon;
  const isExp = tx.type === "expense";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${cat.color}26` }}>
        <Icon size={17} color={cat.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: C.text }}>{tx.note || cat.label}</div>
        <div className="text-xs" style={{ color: C.mutedSoft }}>{cat.label} · {tx.date === todayISO() ? "Aujourd'hui" : tx.date}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums shrink-0" style={{ color: isExp ? C.expenseA : C.mint }}>
        {isExp ? "-" : "+"}{fmt(tx.amount)}
      </div>
    </div>
  );
}

const PERIODS = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

function AppShell() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [period, setPeriod] = useState("week");
  const [monthlyBudget, setMonthlyBudget] = useState(300000);
  const dailyBudget = monthlyBudget / daysInMonth();

  // auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // load data once authenticated, then keep in sync via realtime
  useEffect(() => {
    if (!session) return;
    let unsubscribe = () => {};
    setDataLoading(true);
    Promise.all([fetchTransactions(), fetchMonthlyBudget(session.user.id)])
      .then(([tx, budget]) => {
        setTransactions(tx);
        setMonthlyBudget(budget);
      })
      .finally(() => setDataLoading(false));

    unsubscribe = subscribeToTransactions(session.user.id, () => {
      fetchTransactions().then(setTransactions);
    });
    return () => unsubscribe();
  }, [session]);

  if (session === undefined) {
    return (
      <div className="w-full max-w-sm mx-auto min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <Loader2 size={22} color={C.mutedSoft} className="animate-spin" />
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <Dashboard
      session={session}
      transactions={transactions}
      dataLoading={dataLoading}
      sheetOpen={sheetOpen} setSheetOpen={setSheetOpen}
      tab={tab} setTab={setTab}
      period={period} setPeriod={setPeriod}
      monthlyBudget={monthlyBudget}
      dailyBudget={dailyBudget}
      onAddTransaction={async (tx) => {
        const saved = await addTransaction(tx, session.user.id);
        setTransactions((prev) => [saved, ...prev]);
      }}
    />
  );
}

function Dashboard({
  session, transactions, dataLoading, sheetOpen, setSheetOpen, tab, setTab,
  period, setPeriod, monthlyBudget, dailyBudget, onAddTransaction,
}) {
  const today = todayISO();
  const todayTx = transactions.filter((t) => t.date === today);
  const spentToday = todayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const remainingToday = dailyBudget - spentToday;
  const pct = (spentToday / dailyBudget) * 100;

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const byCategoryAll = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.type === "expense").forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ ...catLookup(id, "expense"), value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // period-filtered stats
  const periodTx = useMemo(() => transactions.filter((t) => inPeriod(t.date, period)), [transactions, period]);
  const periodExpense = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const periodIncome = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const byCategoryPeriod = useMemo(() => {
    const map = {};
    periodTx.filter((t) => t.type === "expense").forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([id, value]) => ({ ...catLookup(id, "expense"), value })).sort((a, b) => b.value - a.value);
  }, [periodTx]);

  const last7Data = useMemo(() => {
    return LAST7.map((d) => {
      const total = transactions.filter((t) => t.type === "expense" && t.date === d).reduce((s, t) => s + t.amount, 0);
      const dow = new Date(d).getDay();
      return { date: d, label: DAY_LABEL[dow], value: total };
    });
  }, [transactions]);

  const sortedTx = [...transactions].sort((a, b) => b.id - a.id);

  return (
    <div className="w-full max-w-sm mx-auto min-h-screen flex flex-col relative" style={{ background: C.bg, fontFamily: "Inter, sans-serif" }}>
      <div className="px-5 pt-6 pb-2 flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: C.mutedSoft }}>Bonjour 👋</div>
          <div className="text-lg font-bold" style={{ color: C.text, fontFamily: "Outfit, sans-serif" }}>DailyBudget</div>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: C.surface }}
          title="Se déconnecter"
        >
          <LogOut size={15} color={C.muted} />
        </button>
      </div>
      {dataLoading && (
        <div className="px-5 pb-1 text-[11px]" style={{ color: C.mutedSoft }}>Synchronisation…</div>
      )}

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        {tab === "dashboard" && (
          <>
            <div className="flex flex-col items-center pt-4 pb-2">
              <div className="relative flex items-center justify-center">
                <BudgetRing pct={pct} />
                <div className="absolute flex flex-col items-center">
                  <span className="text-[11px]" style={{ color: C.mutedSoft }}>Reste aujourd'hui</span>
                  <span className="text-2xl font-extrabold tabular-nums" style={{ color: remainingToday < 0 ? C.expenseA : C.text, fontFamily: "Outfit, sans-serif" }}>
                    {fmt(remainingToday)}
                  </span>
                  <span className="text-[11px] mt-0.5" style={{ color: C.mutedSoft }}>sur {fmt(dailyBudget)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 mb-5">
              <div className="rounded-2xl p-3" style={{ background: C.surface }}>
                <Wallet size={14} color={C.mint} />
                <div className="text-[10px] mt-1" style={{ color: C.mutedSoft }}>Solde</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmt(balance)}</div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: C.surface }}>
                <ArrowUpRight size={14} color={C.incomeB} />
                <div className="text-[10px] mt-1" style={{ color: C.mutedSoft }}>Revenus</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmt(totalIncome)}</div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: C.surface }}>
                <ArrowDownRight size={14} color={C.expenseA} />
                <div className="text-[10px] mt-1" style={{ color: C.mutedSoft }}>Dépenses</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: C.text }}>{fmt(totalExpense)}</div>
              </div>
            </div>

            {byCategoryAll.length > 0 && (
              <div className="rounded-2xl p-4 mb-5" style={{ background: C.surface }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: C.text }}>Par catégorie</span>
                  <PieIcon size={14} color={C.muted} />
                </div>
                <div className="flex items-center gap-4">
                  <div style={{ width: 90, height: 90 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byCategoryAll} dataKey="value" innerRadius={26} outerRadius={42} paddingAngle={3} stroke="none">
                          {byCategoryAll.map((c, i) => <Cell key={i} fill={c.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {byCategoryAll.slice(0, 4).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                          <span className="truncate" style={{ color: C.muted }}>{c.label}</span>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0 ml-2" style={{ color: C.text }}>{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold" style={{ color: C.text }}>Transactions récentes</span>
              <button onClick={() => setTab("transactions")} className="text-xs" style={{ color: C.incomeB }}>Tout voir</button>
            </div>
            <div className="rounded-2xl px-3" style={{ background: C.surface }}>
              {sortedTx.slice(0, 4).map((tx, i) => (
                <div key={tx.id} style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}><TxRow tx={tx} /></div>
              ))}
            </div>
          </>
        )}

        {tab === "transactions" && (
          <div className="pt-4">
            <div className="text-sm font-semibold mb-2" style={{ color: C.text }}>Toutes les transactions</div>
            <div className="rounded-2xl px-3" style={{ background: C.surface }}>
              {sortedTx.map((tx, i) => (
                <div key={tx.id} style={{ borderTop: i > 0 ? `1px solid ${C.line}` : "none" }}><TxRow tx={tx} /></div>
              ))}
              {sortedTx.length === 0 && <div className="text-center py-8 text-sm" style={{ color: C.mutedSoft }}>Aucune transaction</div>}
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div className="pt-4">
            {/* period toggle */}
            <div className="flex rounded-2xl p-1 mb-4" style={{ background: C.surface }}>
              {PERIODS.map((p) => (
                <button
                  key={p.id} onClick={() => setPeriod(p.id)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: period === p.id ? `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})` : "transparent",
                    color: period === p.id ? "#fff" : C.muted,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-2xl p-3" style={{ background: C.surface }}>
                <div className="text-[10px]" style={{ color: C.mutedSoft }}>Dépensé ({PERIODS.find(p=>p.id===period).label.toLowerCase()})</div>
                <div className="text-base font-bold tabular-nums" style={{ color: C.expenseA }}>{fmt(periodExpense)}</div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: C.surface }}>
                <div className="text-[10px]" style={{ color: C.mutedSoft }}>Reçu ({PERIODS.find(p=>p.id===period).label.toLowerCase()})</div>
                <div className="text-base font-bold tabular-nums" style={{ color: C.mint }}>{fmt(periodIncome)}</div>
              </div>
            </div>

            {/* last 7 days bar chart */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface }}>
              <div className="text-xs font-semibold mb-2" style={{ color: C.text }}>7 derniers jours</div>
              <div style={{ width: "100%", height: 90 }}>
                <RC2 width="100%" height="100%">
                  <BarChart data={last7Data}>
                    <XAxis dataKey="label" tick={{ fill: C.mutedSoft, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                      {last7Data.map((d, i) => (
                        <Cell key={i} fill={d.date === today ? C.incomeB : C.surface2} />
                      ))}
                    </Bar>
                  </BarChart>
                </RC2>
              </div>
            </div>

            <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>
              Dépenses par catégorie · {PERIODS.find(p=>p.id===period).label}
            </div>
            {byCategoryPeriod.length === 0 ? (
              <div className="text-center py-8 text-sm" style={{ color: C.mutedSoft }}>Pas de dépenses sur cette période</div>
            ) : (
              <div className="space-y-2.5">
                {byCategoryPeriod.map((c) => {
                  const Icon = c.icon;
                  const pctCat = (c.value / periodExpense) * 100;
                  return (
                    <div key={c.id} className="rounded-2xl p-3" style={{ background: C.surface }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${c.color}33` }}>
                            <Icon size={13} color={c.color} />
                          </div>
                          <span className="text-xs font-medium" style={{ color: C.text }}>{c.label}</span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: C.text }}>{fmt(c.value)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.surface2 }}>
                        <div className="h-full rounded-full" style={{ width: `${pctCat}%`, background: c.color, transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto px-5 pb-5 pt-2" style={{ background: `linear-gradient(to top, ${C.bg} 60%, transparent)` }}>
        <div className="flex items-center justify-between rounded-full px-4 py-2.5 relative" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <button onClick={() => setTab("dashboard")} className="p-2">
            <Wallet size={19} color={tab === "dashboard" ? C.incomeB : C.mutedSoft} />
          </button>
          <button onClick={() => setTab("stats")} className="p-2">
            <PieIcon size={19} color={tab === "stats" ? C.incomeB : C.mutedSoft} />
          </button>
          <button
            onClick={() => setSheetOpen(true)}
            className="absolute left-1/2 flex items-center justify-center rounded-full shadow-lg"
            style={{ width: 52, height: 52, top: -18, transform: "translateX(-50%)", background: `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})`, boxShadow: `0 8px 20px -4px ${C.incomeA}88` }}
          >
            <Plus size={24} color="#fff" />
          </button>
          <button onClick={() => setTab("transactions")} className="p-2">
            <TrendingUp size={19} color={tab === "transactions" ? C.incomeB : C.mutedSoft} />
          </button>
          <button className="p-2">
            <Zap size={19} color={C.mutedSoft} />
          </button>
        </div>
      </div>

      <AddSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={(tx) => onAddTransaction(tx)}
      />
    </div>
  );
}

export default function App() {
  return <AppShell />;
}

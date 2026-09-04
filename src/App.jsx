import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Trash2, Sparkles, Bus, UtensilsCrossed, PlusCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

const DAYS = [
  { key: "lun", label: "Lun" }, { key: "mar", label: "Mar" }, { key: "mer", label: "Mer" },
  { key: "jeu", label: "Jeu" }, { key: "ven", label: "Ven" },
];

const CATEGORIES = [
  { key: "transport", label: "Transport", pool: "aVivre", icon: Bus },
  { key: "nourriture", label: "Nourriture", pool: "aVivre", icon: UtensilsCrossed },
  { key: "plaisir", label: "Plaisir", pool: "plaisir", icon: Sparkles },
  { key: "retrait_objectif", label: "Retrait sur l'épargne objectif", pool: "objectif", icon: AlertTriangle },
  { key: "autre", label: "Autre", pool: "aVivre", icon: PlusCircle },
];

const DEFAULT_SETTINGS = { dailyRate: 2850, savingsTarget: 10000, plaisirPercent: 20 };
const fmt = (n) => Math.round(n).toLocaleString("fr-FR") + " F";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const LOCAL_CODE_KEY = "uniparco-budget-access-code";

function computePools(transactions, settings) {
  let objectif = 0, plaisir = 0, aVivre = 0;
  const history = [];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const t of sorted) {
    if (t.type === "income") {
      const target = Math.min(settings.savingsTarget, t.amount);
      objectif += target * (1 - settings.plaisirPercent / 100);
      plaisir += target * (settings.plaisirPercent / 100);
      aVivre += t.amount - target;
      history.push({ date: t.date, objectif: Math.round(objectif) });
    } else {
      const cat = CATEGORIES.find((c) => c.key === t.category);
      if (cat?.pool === "plaisir") plaisir -= t.amount;
      else if (cat?.pool === "objectif") objectif -= t.amount;
      else aVivre -= t.amount;
    }
  }
  return { objectif, plaisir, aVivre, history };
}

function PoolBar({ label, value, color }) {
  const segments = 5;
  const filled = Math.max(0, Math.min(segments, Math.round((value / 12000) * segments)));
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "18px 20px" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{label}</span>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: value < 0 ? "var(--coral)" : "var(--text)", marginTop: 4 }}>
        {fmt(value)}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div key={i} style={{ height: 5, flex: 1, background: i < filled ? color : "var(--border)" }} />
        ))}
      </div>
    </div>
  );
}

// Écran d'accès : le même code sur chaque appareil pointe vers le même document Firestore
function AccessGate({ onEnter }) {
  const [code, setCode] = useState("");
  return (
    <div style={{ minHeight: "100vh", background: "#12181B", color: "#EDEDE6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (code.trim()) onEnter(code.trim()); }}
        style={{ width: 300, padding: 24, border: "1px solid #2E393F" }}
      >
        <div style={{ fontSize: 18, marginBottom: 8 }}>Ton code d'accès</div>
        <div style={{ fontSize: 13, color: "#93A19D", marginBottom: 14 }}>
          Choisis un code unique la première fois. Utilise EXACTEMENT le même sur tous tes appareils pour retrouver tes données.
        </div>
        <input
          value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex: pmg-uniparco-2026"
          style={{ width: "100%", background: "#12181B", border: "1px solid #2E393F", color: "#EDEDE6", padding: 10, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button type="submit" style={{ width: "100%", background: "#CB9C42", border: "none", padding: 10, fontWeight: 600, cursor: "pointer" }}>
          Continuer
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [accessCode, setAccessCode] = useState(() => localStorage.getItem(LOCAL_CODE_KEY) || "");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [transactions, setTransactions] = useState([]);
  const [weekDays, setWeekDays] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "transport", amount: "", note: "", date: todayISO() });

  function handleEnter(code) {
    localStorage.setItem(LOCAL_CODE_KEY, code);
    setAccessCode(code);
  }

  // Charge + écoute les changements en temps réel depuis Firestore
  useEffect(() => {
    if (!accessCode) return;
    const ref = doc(db, "budgets", accessCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings || {}) });
        setTransactions(data.transactions || []);
        setWeekDays(data.weekDays || {});
      }
      setLoaded(true);
    }, (err) => {
      console.error("Erreur de synchronisation Firestore", err);
      setLoaded(true);
    });
    return () => unsub();
  }, [accessCode]);

  const persist = useCallback(async (next) => {
    if (!accessCode) return;
    try {
      await setDoc(doc(db, "budgets", accessCode), next);
    } catch (e) {
      console.error("Échec de sauvegarde", e);
    }
  }, [accessCode]);

  useEffect(() => {
    if (loaded && accessCode) persist({ settings, transactions, weekDays });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, transactions, weekDays]);

  const pools = useMemo(() => computePools(transactions, settings), [transactions, settings]);
  const pendingDays = Object.values(weekDays).filter(Boolean).length;
  const pendingAmount = pendingDays * settings.dailyRate;

  if (!accessCode) return <AccessGate onEnter={handleEnter} />;

  function toggleDay(key) { setWeekDays((w) => ({ ...w, [key]: !w[key] })); }

  function encaisser() {
    if (pendingAmount <= 0) return;
    setTransactions((ts) => [...ts, { id: uid(), type: "income", amount: pendingAmount, date: todayISO(), note: `${pendingDays} jour(s) travaillé(s)` }]);
    setWeekDays({});
  }

  function addExpense(e) {
    e.preventDefault();
    const amount = parseFloat(expenseForm.amount);
    if (!amount || amount <= 0) return;
    setTransactions((ts) => [...ts, { id: uid(), type: "expense", category: expenseForm.category, amount, note: expenseForm.note, date: expenseForm.date }]);
    setExpenseForm({ category: "transport", amount: "", note: "", date: todayISO() });
  }

  function removeTransaction(id) { setTransactions((ts) => ts.filter((t) => t.id !== id)); }

  const chartData = pools.history.map((h, i) => ({ name: `V${i + 1}`, objectif: h.objectif }));
  const sortedTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <div style={{
      "--bg": "#12181B", "--surface": "#1B2328", "--border": "#2E393F",
      "--text": "#EDEDE6", "--text-muted": "#93A19D",
      "--gold": "#CB9C42", "--green": "#5B9279", "--coral": "#C9705A",
      "--font-display": "'Fraunces', Georgia, serif", "--font-body": "'Inter', system-ui, sans-serif",
      background: "var(--bg)", color: "var(--text)", minHeight: "100vh", padding: "24px 16px 48px",
      fontFamily: "var(--font-body)",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        .btn { font-family: var(--font-body); cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 10px 16px; font-size: 14px; }
        .btn:hover { border-color: var(--gold); }
        .btn-primary { background: var(--gold); color: #14181B; border-color: var(--gold); font-weight: 600; }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .field { background: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 9px 10px; font-family: var(--font-body); font-size: 14px; width: 100%; box-sizing: border-box; }
        .field:focus { outline: none; border-color: var(--gold); }
        .day-chip { flex: 1; text-align: center; padding: 12px 0; border: 1px solid var(--border); cursor: pointer; font-size: 13px; color: var(--text-muted); }
        .day-chip.active { background: var(--green); border-color: var(--green); color: #0E1512; font-weight: 600; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.15 }}>Ma semaine chez Uniparco</div>
            <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
              Coche les jours travaillés, encaisse le vendredi, garde un œil sur tes trois poches.
            </div>
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {DAYS.map((d) => (
              <div key={d.key} className={`day-chip ${weekDays[d.key] ? "active" : ""}`} onClick={() => toggleDay(d.key)}>{d.label}</div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{pendingDays} jour(s) × {fmt(settings.dailyRate)}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{fmt(pendingAmount)}</div>
            </div>
            <button className="btn btn-primary" disabled={pendingAmount <= 0} onClick={encaisser}>Encaisser la semaine</button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
          <PoolBar label="Épargne objectif (intouchable)" value={pools.objectif} color="var(--green)" />
          <PoolBar label="Pot plaisir" value={pools.plaisir} color="var(--gold)" />
          <PoolBar label="À vivre (transport, nourriture...)" value={pools.aVivre} color="var(--coral)" />
        </div>

        {chartData.length > 1 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "16px 8px 8px", marginBottom: 16 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "0 12px 8px" }}>Progression de l'épargne objectif</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#93A19D", fontSize: 11 }} axisLine={{ stroke: "#2E393F" }} tickLine={false} />
                <YAxis tick={{ fill: "#93A19D", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: "#1B2328", border: "1px solid #2E393F", fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="objectif" stroke="var(--green)" strokeWidth={2} dot={{ r: 3, fill: "var(--green)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <form onSubmit={addExpense} style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 12 }}>Enregistrer une dépense</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <select className="field" value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input className="field" type="number" placeholder="Montant (F)" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <input className="field" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} />
            <input className="field" type="text" placeholder="Note (ex: parfum, taxi...)" value={expenseForm.note} onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          {expenseForm.category === "retrait_objectif" && (
            <div style={{ display: "flex", gap: 8, color: "var(--coral)", fontSize: 12.5, marginBottom: 12 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Ce retrait réduit directement ton objectif principal (candidatures, formations, investissement).</span>
            </div>
          )}
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }}>Ajouter</button>
        </form>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", cursor: "pointer" }} onClick={() => setShowSettings((s) => !s)}>
            <span style={{ fontSize: 14 }}>Réglages de répartition</span>
            {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {showSettings && (
            <div style={{ padding: "0 20px 20px", display: "grid", gap: 12 }}>
              <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Taux journalier (F)
                <input className="field" style={{ marginTop: 4 }} type="number" value={settings.dailyRate} onChange={(e) => setSettings((s) => ({ ...s, dailyRate: parseFloat(e.target.value) || 0 }))} />
              </label>
              <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Épargne visée par versement (F)
                <input className="field" style={{ marginTop: 4 }} type="number" value={settings.savingsTarget} onChange={(e) => setSettings((s) => ({ ...s, savingsTarget: parseFloat(e.target.value) || 0 }))} />
              </label>
              <label style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Part plaisir dans l'épargne (%)
                <input className="field" style={{ marginTop: 4 }} type="number" min="0" max="100" value={settings.plaisirPercent} onChange={(e) => setSettings((s) => ({ ...s, plaisirPercent: parseFloat(e.target.value) || 0 }))} />
              </label>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, marginBottom: 10 }}>Historique</div>
          {sortedTx.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Rien pour l'instant — encaisse ta première semaine pour commencer.</div>}
          <div style={{ display: "grid", gap: 6 }}>
            {sortedTx.map((t) => {
              const cat = CATEGORIES.find((c) => c.key === t.category);
              const isIncome = t.type === "income";
              return (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", padding: "10px 14px" }}>
                  <div>
                    <div style={{ fontSize: 13.5 }}>{isIncome ? "Versement" : cat?.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.date}{t.note ? ` · ${t.note}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 600, color: isIncome ? "var(--green)" : "var(--coral)" }}>{isIncome ? "+" : "−"}{fmt(t.amount)}</span>
                    <Trash2 size={15} style={{ cursor: "pointer", color: "var(--text-muted)" }} onClick={() => removeTransaction(t.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

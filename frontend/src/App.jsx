import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000';

// ── Avatar gradient palette (deterministic by name) ──────────────────────────
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7a1f3a 0%, #236b52 100%)', // wine → teal
  'linear-gradient(135deg, #5c1a2e 0%, #6b9476 100%)', // deep wine → sage
  'linear-gradient(135deg, #1b4a3b 0%, #6b9476 100%)', // forest → sage
  'linear-gradient(135deg, #9e2a4a 0%, #1b4a3b 100%)', // bright wine → forest
  'linear-gradient(135deg, #6b9476 0%, #7a1f3a 100%)', // sage → wine
  'linear-gradient(135deg, #236b52 0%, #9e2a4a 100%)', // teal → bright wine
  'linear-gradient(135deg, #3a9e78 0%, #5c1a2e 100%)', // bright teal → deep wine
];

function getAvatarGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Currency formatter (PKR) ─────────────────────────────────────────────────
function formatPKR(amount) {
  return `₨ ${Math.abs(amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  Balances: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Expenses: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
    </svg>
  ),
  People: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  Warning: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Success: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <path d="M22 4 12 14.01l-3-3"/>
    </svg>
  ),
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Equal: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>
    </svg>
  ),
  Sliders: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/><path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  Handshake: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/>
    </svg>
  ),
};

// ── Avatar Component ──────────────────────────────────────────────────────────
function Avatar({ name, size = '' }) {
  return (
    <div
      className={`avatar ${size ? `avatar-${size}` : ''}`}
      style={{ background: getAvatarGradient(name) }}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [people, setPeople]                     = useState([]);
  const [expenses, setExpenses]                 = useState([]);
  const [debts, setDebts]                       = useState([]);
  const [individualBalances, setIndividualBalances] = useState({});
  const [settlements, setSettlements]           = useState([]);
  const [currentPage, setCurrentPage]           = useState('balances');
  const [loading, setLoading]                   = useState(false);
  const [notification, setNotification]         = useState(null);

  // Form states
  const [newPersonName, setNewPersonName]       = useState('');
  const [expenseAmount, setExpenseAmount]       = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expensePayer, setExpensePayer]         = useState('');
  const [expenseSplitBetween, setExpenseSplitBetween] = useState([]);
  const [splitType, setSplitType]               = useState('equal');
  const [customSplits, setCustomSplits]         = useState({});

  // Settlement modal
  const [settleModalOpen, setSettleModalOpen]   = useState(false);
  const [settleDebtor, setSettleDebtor]         = useState('');
  const [settleCreditor, setSettleCreditor]     = useState('');
  const [settleAmount, setSettleAmount]         = useState('');
  // Currency converter states
  const [convAmount, setConvAmount] = useState('');
  const [convFrom, setConvFrom] = useState('USD');
  const [rates, setRates] = useState({});
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    try { return localStorage.getItem('displayCurrency') || 'PKR'; } catch (e) { return 'PKR'; }
  });

  // ── Notification ─────────────────────────────────────────────────────────
  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, eRes, bRes] = await Promise.all([
        fetch(`${API_BASE}/people`),
        fetch(`${API_BASE}/expenses`),
        fetch(`${API_BASE}/balances`),
      ]);
      if (!pRes.ok || !eRes.ok || !bRes.ok) throw new Error('Failed to fetch data');
      const [pData, eData, bData] = await Promise.all([pRes.json(), eRes.json(), bRes.json()]);
      setPeople(pData);
      setExpenses([...eData].reverse());
      setDebts(bData.debts || []);
      setIndividualBalances(bData.balances || {});
      setSettlements([...(bData.settlements || [])].reverse());
    } catch (err) {
      showNotification(err.message || 'Error connecting to server', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    // fetch rates for inline conversions
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/rates`);
        if (!res.ok) return;
        const data = await res.json();
        setRates(data || {});
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('displayCurrency', displayCurrency); } catch (e) { /* ignore */ }
  }, [displayCurrency]);

  function formatCurrency(amount, currency) {
    const n = Number(amount) || 0;
    const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const formatted = n.toLocaleString('en-US', opts);
    const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : currency === 'PKR' ? '₨ ' : '';
    // For PKR, keep spacing/format used elsewhere
    return currency === 'PKR' ? `₨ ${n.toLocaleString('en-PK', opts)}` : `${sym}${formatted}`;
  }

  useEffect(() => {
    if (people.length > 0 && !expensePayer) setExpensePayer(people[0]);
    if (people.length > 0 && expenseSplitBetween.length === 0) setExpenseSplitBetween([...people]);
  }, [people]);

  // ── Custom split helpers ──────────────────────────────────────────────────
  const customSplitsSum = expenseSplitBetween.reduce((s, p) => s + (parseFloat(customSplits[p]) || 0), 0);
  const totalAmountNum  = parseFloat(expenseAmount);
  const splitsSumMatches = !isNaN(totalAmountNum) && totalAmountNum > 0 && Math.abs(customSplitsSum - totalAmountNum) <= 0.01;
  const showSplitWarning = splitType === 'custom' && !isNaN(totalAmountNum) && totalAmountNum > 0 && Math.abs(customSplitsSum - totalAmountNum) > 0.01;

  const handleCustomSplitChange = (person, value) =>
    setCustomSplits(prev => ({ ...prev, [person]: value }));

  // ── Add Person ────────────────────────────────────────────────────────────
  const handleAddPerson = async (e) => {
    e.preventDefault();
    const name = newPersonName.trim();
    if (!name) return;
    try {
      const res  = await fetch(`${API_BASE}/people/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add person');
      showNotification(`✓ ${name} added to the group!`);
      setNewPersonName('');
      fetchData();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  // ── Add Expense ───────────────────────────────────────────────────────────
  const handleAddExpense = async (e) => {
    e.preventDefault();
    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) return showNotification('Enter a valid amount > 0', 'error');
    if (!expensePayer) return showNotification('Select a payer', 'error');

    if (splitType === 'equal') {
      if (expenseSplitBetween.length === 0) return showNotification('Select at least one person to split with', 'error');
    } else {
      if (expenseSplitBetween.length === 0) return showNotification('Select people with custom amounts', 'error');
      if (!splitsSumMatches) return showNotification(`Splits total (${formatPKR(customSplitsSum)}) ≠ expense total (${formatPKR(amount)})`, 'error');
    }

    const payload = { payer: expensePayer, amount, description: expenseDescription.trim() };
    if (splitType === 'equal') {
      payload.split_between = expenseSplitBetween;
    } else {
      const splitsObj = {};
      expenseSplitBetween.forEach(p => { splitsObj[p] = parseFloat(customSplits[p]) || 0; });
      payload.splits = splitsObj;
    }

    try {
      const res  = await fetch(`${API_BASE}/expense/add`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add expense');
      showNotification('Expense recorded!');
      setExpenseAmount(''); setExpenseDescription(''); setCustomSplits({});
      setSplitType('equal'); setExpenseSplitBetween([...people]);
      fetchData();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  // ── Settle Debt ───────────────────────────────────────────────────────────
  const handleSettleDebt = async (e) => {
    e.preventDefault();
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) return showNotification('Enter a valid settlement amount', 'error');
    try {
      const res  = await fetch(`${API_BASE}/settle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtor: settleDebtor, creditor: settleCreditor, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle');
      showNotification(`Settlement of ${formatPKR(amount)} recorded!`);
      setSettleModalOpen(false); setSettleAmount('');
      fetchData();
    } catch (err) { showNotification(err.message, 'error'); }
  };

  const openSettleModal = (debtor, creditor, amt) => {
    setSettleDebtor(debtor); setSettleCreditor(creditor);
    setSettleAmount(amt.toFixed(2)); setSettleModalOpen(true);
  };

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const handleCheckboxChange = (person) => {
    if (expenseSplitBetween.includes(person)) {
      setExpenseSplitBetween(prev => prev.filter(p => p !== person));
      setCustomSplits(prev => { const n = { ...prev }; delete n[person]; return n; });
    } else {
      setExpenseSplitBetween(prev => [...prev, person]);
    }
  };

  const toggleSelectAll = () => {
    if (expenseSplitBetween.length === people.length) {
      setExpenseSplitBetween([]); setCustomSplits({});
    } else {
      setExpenseSplitBetween([...people]);
    }
  };

  // ── Utility calcs ─────────────────────────────────────────────────────────
  const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0);
  const totalOwed        = debts.reduce((s, d) => s + d.amount, 0);
  const totalSettled     = settlements.reduce((s, st) => s + st.amount, 0);

  // ── Sidebar nav items ─────────────────────────────────────────────────────
  const navItems = [
    { id: 'balances', label: 'Balances', icon: 'Balances', badge: debts.length || null },
    { id: 'expenses', label: 'Expenses',  icon: 'Expenses', badge: null },
    { id: 'people',   label: 'People',    icon: 'People',   badge: people.length || null },
  ];

  return (
    <div className="app-layout">
      {loading && <div className="loading-bar" />}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v20M2 12h20"/>
              <circle cx="12" cy="12" r="9" strokeWidth="2"/>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <div className="sidebar-logo-title">SplitWise</div>
            <div className="sidebar-logo-subtitle">PKR Edition</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const IconComp = Icons[item.icon];
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(item.id)}
              >
                <IconComp />
                <span className="sidebar-nav-label">{item.label}</span>
                {item.badge != null && <span className="sidebar-nav-badge">{item.badge}</span>}
              </button>
            );
          })}

          <div className="sidebar-divider" />

          <div style={{ padding: '4px 0 0', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', paddingLeft: '14px', marginBottom: '6px' }}>
            Summary
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="flex-between">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total Expenses</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{formatPKR(totalExpenses)}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Settled</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>{formatPKR(totalSettled)}</span>
            </div>
            <div className="flex-between">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Outstanding</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>{formatPKR(totalOwed)}</span>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-refresh-btn" onClick={fetchData} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'spin' : ''}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {loading ? 'Refreshing…' : 'Refresh Data'}
          </button>
          <div style={{ marginTop: 12 }}>
            <div className="currency-converter">
              <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 6 }}>Convert to PKR</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-input" value={convFrom} onChange={e => setConvFrom(e.target.value)} style={{ padding: '8px 10px', width: 90 }}>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>INR</option>
                  <option>PKR</option>
                </select>
                <input className="form-input" placeholder="Amount" value={convAmount} onChange={e => setConvAmount(e.target.value)} style={{ flex: 1 }} />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/convert`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: convAmount, from: convFrom })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Conversion failed');
                      showNotification(`${data.amount} ${data.from} → ₨ ${data.pkr.toLocaleString('en-PK')}`);
                    } catch (err) {
                      showNotification(err.message || 'Conversion error', 'error');
                    }
                  }}
                >
                  Convert
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  if (!confirm('Bulk-convert all expenses to PKR? A backup will be created.')) return;
                  try {
                    const res = await fetch(`${API_BASE}/convert/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'expenses', from: convFrom }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Bulk conversion failed');
                    showNotification(data.message);
                    fetchData();
                  } catch (err) { showNotification(err.message || 'Error', 'error'); }
                }}>Bulk: Expenses</button>
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  if (!confirm('Bulk-convert all settlements to PKR? A backup will be created.')) return;
                  try {
                    const res = await fetch(`${API_BASE}/convert/data`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: 'settlements', from: convFrom }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Bulk conversion failed');
                    showNotification(data.message);
                    fetchData();
                  } catch (err) { showNotification(err.message || 'Error', 'error'); }
                }}>Bulk: Settlements</button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="main-content">

        <div className="global-currency-selector" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 40px 0' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginRight: 8, alignSelf: 'center' }}>Display:</label>
          <select className="form-input" value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)} style={{ width: 120 }}>
            {Object.keys(rates).length > 0 ? Object.keys(rates).map(c => <option key={c}>{c}</option>) : (
              ["PKR","USD","EUR","INR"].map(c => <option key={c}>{c}</option>)
            )}
          </select>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="toast-container">
            <div className={`toast toast-${notification.type}`}>
              <div className="toast-icon">
                {notification.type === 'success' ? <Icons.Success /> : <Icons.Warning />}
              </div>
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* ── BALANCES PAGE ──────────────────────────────────────────── */}
        {currentPage === 'balances' && (
          <div className="page-view" key="balances">
            <div className="page-hero">
              <div className="page-hero-eyebrow">Overview</div>
              <h1 className="page-hero-title">Balances</h1>
              <p className="page-hero-subtitle">See who owes what and settle debts with one tap.</p>
            </div>

            {/* Hero summary card */}
            <div className="grid-3" style={{ marginBottom: '28px' }}>
              <div className="card stat-card" style={{ background: 'var(--grad-primary)', border: 'none', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                  {debts.length > 0 ? 'Total Outstanding' : '✓ All Settled Up!'}
                </div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '8px' }}>
                  {formatPKR(totalOwed)}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.65)' }}>
                  {debts.length > 0 ? `Across ${debts.length} outstanding ${debts.length === 1 ? 'debt' : 'debts'}` : 'Your group is all square — great job!'}
                </div>
              </div>
              <div className="card stat-card" style={{ justifyContent: 'center' }}>
                <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.15)', margin: '0 auto 8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
                </div>
                <div className="stat-card-value" style={{ color: 'var(--success)', fontSize: '1.6rem' }}>{formatPKR(totalSettled)}</div>
                <div className="stat-card-label">Settled</div>
              </div>
            </div>

            {/* Active debts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px' }}>
              <div>
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Active Debts</h2>
                  {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Updating…</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {debts.length === 0 ? (
                    <div className="card card-body empty-state">
                      <div className="empty-state-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
                      </div>
                      <div className="empty-state-title">All cleared!</div>
                      <div className="empty-state-desc">No outstanding debts. Your group is perfectly settled.</div>
                    </div>
                  ) : (
                    debts.map((debt, i) => {
                      // Find total amount ever owed between debtor → creditor from expenses
                      const progress = Math.min(100, Math.round((totalSettled / (totalOwed + totalSettled)) * 100));
                      return (
                        <div key={i} className="card debt-card">
                          <Avatar name={debt.from} />
                          <div className="debt-card-info">
                            <div className="debt-card-relationship">
                              <strong>{debt.from}</strong> owes <strong>{debt.to}</strong>
                            </div>
                            <div className="debt-card-amount">{formatPKR(debt.amount)}</div>
                            <div className="debt-progress-bar">
                              <div className="debt-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                          <button
                            className="btn btn-success btn-settle btn-sm"
                            onClick={() => openSettleModal(debt.from, debt.to, debt.amount)}
                          >
                            Settle
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Settlement history */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Recent Settlements</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {settlements.length === 0 ? (
                    <div className="card card-body empty-state" style={{ padding: '32px' }}>
                      <div className="empty-state-icon"><Icons.Handshake /></div>
                      <div className="empty-state-title">No settlements yet</div>
                      <div className="empty-state-desc">Settle a debt and it'll appear here.</div>
                    </div>
                  ) : (
                    settlements.map(s => (
                      <div key={s.id} className="settlement-item">
                        <Avatar name={s.debtor} size="sm" />
                        <div className="settlement-info">
                          <div className="settlement-parties">{s.debtor} → {s.creditor}</div>
                          <div className="settlement-label">Settled up</div>
                        </div>
                        <span className="settlement-amount">{
                          displayCurrency === 'PKR' ? (
                            formatPKR(s.amount)
                          ) : (
                            (() => {
                              const src = displayCurrency;
                              const rate = rates && rates[src] ? parseFloat(rates[src]) : null;
                              const orig = Number(s.amount) || 0;
                              const converted = rate ? (orig * rate) : null;
                              return (
                                <>
                                  <span>{formatCurrency(orig, src)}</span>
                                  {converted != null && <span style={{ marginLeft: 8, fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>→ ₨ {converted.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                </>
                              );
                            })()
                          )
                        }</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Individual balances strip */}
            {people.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Individual Balances</h2>
                <div className="grid-auto">
                  {people.map(person => {
                    const bal = individualBalances[person] || 0;
                    const isPositive = bal > 0.01;
                    const isNegative = bal < -0.01;
                    return (
                      <div key={person} className="card person-card">
                        <Avatar name={person} size="lg" />
                        <div className="person-card-name">{person}</div>
                        <div className="person-card-balance" style={{ color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                          {isPositive ? `Owed ${formatPKR(bal)}` : isNegative ? `Owes ${formatPKR(Math.abs(bal))}` : '✓ Settled'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EXPENSES PAGE ──────────────────────────────────────────── */}
        {currentPage === 'expenses' && (
          <div className="page-view" key="expenses">
            <div className="page-hero">
              <div className="page-hero-eyebrow">Transactions</div>
              <h1 className="page-hero-title">Expenses</h1>
              <p className="page-hero-subtitle">Record group expenses and choose how to split them.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '28px' }}>
              {/* Add expense form */}
              <div className="card card-body" style={{ alignSelf: 'start' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Record Expense</div>
                    <div className="card-subtitle">Enter the details below</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icons.Plus />
                  </div>
                </div>

                {people.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Icons.People /></div>
                    <div className="empty-state-title">No people yet</div>
                    <div className="empty-state-desc">Add people to your group first.</div>
                    <button className="btn btn-primary mt-4" onClick={() => setCurrentPage('people')}>Add People</button>
                  </div>
                ) : (
                  <form onSubmit={handleAddExpense} className="form-stack">
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <input className="form-input" type="text" placeholder="e.g. Dinner, Petrol, Tickets…" value={expenseDescription} onChange={e => setExpenseDescription(e.target.value)} required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Amount (PKR ₨)</label>
                      <input className="form-input" type="number" step="1" min="1" placeholder="0" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Paid By</label>
                      <select className="form-input" value={expensePayer} onChange={e => setExpensePayer(e.target.value)}>
                        {people.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Split Method</label>
                      <div className="split-toggle-wrapper">
                        <button type="button" className={`split-toggle-btn ${splitType === 'equal' ? 'active' : ''}`} onClick={() => setSplitType('equal')}>
                          <Icons.Equal /> Equal
                        </button>
                        <button type="button" className={`split-toggle-btn ${splitType === 'custom' ? 'active' : ''}`} onClick={() => setSplitType('custom')}>
                          <Icons.Sliders /> Custom
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="checklist-controls">
                        <label className="form-label">Split Between</label>
                        <button type="button" className="checklist-select-all" onClick={toggleSelectAll}>
                          {expenseSplitBetween.length === people.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div className="people-checklist">
                        {people.map(person => {
                          const isChecked = expenseSplitBetween.includes(person);
                          return (
                            <div
                              key={person}
                              className={`people-check-item ${isChecked ? 'checked' : ''}`}
                              onClick={() => handleCheckboxChange(person)}
                            >
                              <div className="people-check-item-left">
                                <div className={`pill-checkbox ${isChecked ? 'checked' : ''}`}>
                                  <Icons.Check />
                                </div>
                                <span className="people-check-name">{person}</span>
                              </div>
                              {splitType === 'custom' && isChecked && (
                                <div
                                  className="custom-split-input"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <span className="custom-split-input-prefix">₨</span>
                                  <input
                                    type="number"
                                    className="custom-split-num"
                                    step="1"
                                    min="0"
                                    placeholder="0"
                                    value={customSplits[person] || ''}
                                    onChange={e => handleCustomSplitChange(person, e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {splitType === 'equal' && expenseSplitBetween.length > 0 && (
                        <div className="split-status-bar" style={{ marginTop: '8px' }}>
                          <span className="split-status-label">Each person pays</span>
                          <span className="split-status-value matched">
                            {formatPKR((parseFloat(expenseAmount) || 0) / expenseSplitBetween.length)}
                          </span>
                        </div>
                      )}

                      {splitType === 'custom' && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div className="split-status-bar">
                            <span className="split-status-label">Running Total</span>
                            <span className={`split-status-value ${splitsSumMatches ? 'matched' : 'unmatched'}`}>
                              {formatPKR(customSplitsSum)} / {formatPKR(parseFloat(expenseAmount) || 0)}
                            </span>
                          </div>
                          {showSplitWarning && (
                            <div className="split-warning-msg">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                              Splits must add up to {formatPKR(parseFloat(expenseAmount) || 0)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={splitType === 'custom' && !splitsSumMatches}
                      style={{ marginTop: '8px' }}
                    >
                      <Icons.Plus /> Add Expense
                    </button>
                  </form>
                )}
              </div>

              {/* Expense log timeline */}
              <div>
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700 }}>Expense Log</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{expenses.length} entries</span>
                </div>

                {expenses.length === 0 ? (
                  <div className="card card-body empty-state">
                    <div className="empty-state-icon"><Icons.Expenses /></div>
                    <div className="empty-state-title">No expenses yet</div>
                    <div className="empty-state-desc">Record your first group expense.</div>
                  </div>
                ) : (
                  <div className="timeline">
                    {expenses.map((exp, i) => {
                      const isCustom = exp.splits && Object.keys(exp.splits).length > 0;
                      const dotColor = getAvatarGradient(exp.payer);
                      return (
                        <div key={exp.id} className="timeline-item">
                          <div className="timeline-dot" style={{ background: dotColor }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                              <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                            </svg>
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-content-header">
                                        <div className="timeline-title">{exp.description || 'Untitled Expense'}</div>
                                        <div className="timeline-amount" style={{ background: 'var(--grad-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                          {displayCurrency === 'PKR' ? (
                                            formatPKR(exp.amount)
                                          ) : (
                                            (() => {
                                              const src = displayCurrency;
                                              const rate = rates && rates[src] ? parseFloat(rates[src]) : null;
                                              const orig = Number(exp.amount) || 0;
                                              const converted = rate ? (orig * rate) : null;
                                              return (
                                                <>
                                                  <span>{formatCurrency(orig, src)}</span>
                                                  {converted != null && <span style={{ marginLeft: 8, fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>→ ₨ {converted.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                                </>
                                              );
                                            })()
                                          )}
                                        </div>
                            </div>
                            <div className="timeline-meta">
                              Paid by <strong style={{ color: 'var(--text-secondary)' }}>{exp.payer}</strong>
                              {' · '}
                              Split with {exp.split_between.join(', ')}
                            </div>
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                className="timeline-tag"
                                style={{
                                  background: isCustom ? 'rgba(124,58,237,0.12)' : 'rgba(6,182,212,0.12)',
                                  color: isCustom ? 'var(--purple-light)' : 'var(--cyan)',
                                  border: `1px solid ${isCustom ? 'rgba(124,58,237,0.25)' : 'rgba(6,182,212,0.25)'}`,
                                }}
                              >
                                {isCustom ? '⊕ Custom' : '⇌ Equal'}
                              </span>
                              {!isCustom && exp.split_between.length > 0 && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                  {formatPKR(exp.amount / exp.split_between.length)} each
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PEOPLE PAGE ────────────────────────────────────────────── */}
        {currentPage === 'people' && (
          <div className="page-view" key="people">
            <div className="page-hero">
              <div className="page-hero-eyebrow">Members</div>
              <h1 className="page-hero-title">Your Group</h1>
              <p className="page-hero-subtitle">Manage the people you share expenses with.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px' }}>
              {/* Add person form */}
              <div className="card card-body" style={{ alignSelf: 'start' }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Add Member</div>
                    <div className="card-subtitle">Invite to your group</div>
                  </div>
                </div>
                <form onSubmit={handleAddPerson} className="form-stack">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g. Ali Hassan"
                      value={newPersonName}
                      onChange={e => setNewPersonName(e.target.value)}
                      required
                    />
                  </div>
                  {newPersonName.trim() && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                      <Avatar name={newPersonName} />
                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{newPersonName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Preview</div>
                      </div>
                    </div>
                  )}
                  <button type="submit" className="btn btn-primary">
                    <Icons.Plus /> Add to Group
                  </button>
                </form>
              </div>

              {/* People grid */}
              <div>
                <div className="flex-between" style={{ marginBottom: '16px' }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700 }}>
                    Members <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '0.9rem' }}>({people.length})</span>
                  </h2>
                </div>

                {people.length === 0 ? (
                  <div className="card card-body empty-state">
                    <div className="empty-state-icon"><Icons.People /></div>
                    <div className="empty-state-title">No members yet</div>
                    <div className="empty-state-desc">Add people to start splitting expenses.</div>
                  </div>
                ) : (
                  <div className="grid-auto">
                    {people.map(person => {
                      const bal = individualBalances[person] || 0;
                      const isPositive = bal > 0.01;
                      const isNegative = bal < -0.01;
                      return (
                        <div key={person} className="card person-card">
                          <Avatar name={person} size="lg" />
                          <div className="person-card-name">{person}</div>
                          <div
                            className="person-card-balance"
                            style={{ color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-tertiary)' }}
                          >
                            {isPositive
                              ? `Owed ${formatPKR(bal)}`
                              : isNegative
                              ? `Owes ${formatPKR(Math.abs(bal))}`
                              : '✓ Settled'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Settle Modal ──────────────────────────────────────────────── */}
      {settleModalOpen && (
        <div className="modal-overlay" onClick={() => setSettleModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--grad-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icons.Handshake />
              </div>
              <div>
                <div className="modal-title">Record Settlement</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Confirm this payment</div>
              </div>
            </div>

            <p className="modal-desc">
              <strong>{settleDebtor}</strong> is settling their debt with <strong>{settleCreditor}</strong>.
              Confirm the transfer amount below.
            </p>

            <form onSubmit={handleSettleDebt} className="form-stack">
              <div className="form-group">
                <label className="form-label">Transfer Amount (PKR ₨)</label>
                <input
                  className="form-input"
                  type="number"
                  step="1"
                  min="1"
                  placeholder="0"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'rgba(16,185,129,0.06)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.15)' }}>
                <Avatar name={settleDebtor} size="sm" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{settleDebtor}</span>
                  <span style={{ color: 'var(--success)', fontSize: '1rem' }}>→</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{settleCreditor}</span>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setSettleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success">Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

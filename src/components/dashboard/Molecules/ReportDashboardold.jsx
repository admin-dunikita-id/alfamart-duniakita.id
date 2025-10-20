import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import 'chart.js/auto';
import { useSchedule } from '@/context/ScheduleContext';
import * as XLSX from 'xlsx';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Swal from 'sweetalert2';
import { useAuth } from '@/context';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const TABS = [
  { key: 'shift', label: 'Laporan Shift' },
  { key: 'leave', label: 'Laporan Cuti / Izin / Sakit' },
  { key: 'swap',  label: 'Laporan Tukar Shift' },
];

const ReportDashboard = () => {
  const { scheduleAPI } = useSchedule();
  const { user } = useAuth() || {}; // NEW

  const [activeTab, setActiveTab] = useState('shift');
  const [shift, setShift] = useState(null);
  const [leave, setLeave] = useState(null);
  const [swap,  setSwap]  = useState(null);

  // === FILTERS ===
  const [filterText, setFilterText] = useState('');
  const [startDate, setStartDate]   = useState(''); // NEW
  const [endDate, setEndDate]       = useState(''); // NEW
  const [selectedStoreId, setSelectedStoreId] = useState(''); // NEW

  // === STORES (untuk select) ===
  const [stores, setStores] = useState([]);         // NEW
  const [loadingStores, setLoadingStores] = useState(true); // NEW

  // ======================================
  // ============ Helper ==================
  // ======================================
const getYearMonthFromFilters = () => {
  // prioritas: startDate -> endDate -> today
  const base = toISODate(startDate) || toISODate(endDate) || new Date().toISOString().slice(0,10);
  const d = new Date(base + 'T00:00:00');
  return { y: d.getFullYear(), m: d.getMonth() }; // m: 0..11
};

// Buat daftar tanggal YYYY-MM-DD dalam 1 bulan, bisa di-clip oleh startDate/endDate
const buildMonthDates = (y, m, clipStart, clipEnd) => {
  const days = new Date(y, m + 1, 0).getDate();
  const out = [];
  for (let i = 1; i <= days; i++) {
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    if ( (!clipStart || toEpoch(iso) >= toEpoch(toISODate(clipStart))) &&
         (!clipEnd   || toEpoch(iso) <= toEpoch(toISODate(clipEnd))) ) {
      out.push(iso);
    }
  }
  return out;
};

  const firstFilled = (...vals) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s !== "") return s;
    }
    return "";
  };

  const normStatus = (s) => String(s || "").toLowerCase();

  const role = String(currentUser?.role || '').toLowerCase();
const canSelectAnyStore = role === 'admin' || role === 'ac';

// untuk COS/ACOS ambil store yg terkait user (mis. currentUser.store_id & store_name)
const myStoreId = currentUser?.store_id ?? '';
const myStoreLabel = currentUser?.store?.store_name || currentUser?.store_name || '-';

const [stores, setStores] = React.useState([]);
const [loadingStores, setLoadingStores] = React.useState(false);

// selectedStoreId:
// - admin/ac: default kosong = "Semua Store"
// - cos/acos: paksa ke store-nya sendiri
const [selectedStoreId, setSelectedStoreId] = React.useState(
  canSelectAnyStore ? '' : String(myStoreId || '')
);

// load stores HANYA untuk admin/ac
React.useEffect(() => {
  if (!canSelectAnyStore) return;
  let alive = true;
  (async () => {
    try {
      setLoadingStores(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/stores`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const data = await res.json();
      if (alive) setStores(Array.isArray(data) ? data : (data?.data || []));
    } finally {
      if (alive) setLoadingStores(false);
    }
  })();
  return () => { alive = false; };
}, [canSelectAnyStore]);

// kalau role berubah (atau user ganti), sinkronkan selectedStoreId
React.useEffect(() => {
  setSelectedStoreId(canSelectAnyStore ? '' : String(myStoreId || ''));
}, [canSelectAnyStore, myStoreId]);

    // --- RESET FILTERS ---
  const resetFilters = () => {
    setFilterText('');
    setStartDate('');
    setEndDate('');
    // Admin/AC: reset ke "Semua Store" (kosong)
    if (canSelectAnyStore) {
      setSelectedStoreId('');
    } else {
      // COS/ACOS: kunci ke store pertama yang ia miliki (biar tetap valid)
      if (selectableStores.length) {
        setSelectedStoreId(String(selectableStores[0].id));
      }
    }
  };

  const isFilterActive =
    !!(filterText || startDate || endDate || (canSelectAnyStore && selectedStoreId));
  
// ubah "01/09/2025", "01-09-2025", "2025/09/01", "2025-09-01" -> "2025-09-01"
const toISODate = (s) => {
  if (!s) return null;
  const t = String(s).slice(0, 10).replace(/\//g, '-').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; // YYYY-MM-DD
  const m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
};
const toEpoch = (iso) => (iso ? new Date(iso + 'T00:00:00').getTime() : null);

  // NEW: helper cocokkan tanggal & store saat fallback client-side
  const fmtDate = (d) => (String(d||'').slice(0,10)); // YYYY-MM-DD
const isWithinRange = (dateStr, start, end) => {
  const dIso = toISODate(dateStr);
  if (!dIso) return false;
  const d = toEpoch(dIso);
  const s = toEpoch(toISODate(start));
  const e = toEpoch(toISODate(end));
  if (s != null && d < s) return false;
  if (e != null && d > e) return false;
  return true;
};

  const matchStore = (row, storeId) => {
    if (!storeId) return true;
    const sid = Number(storeId);
    const candidates = [
      row.store_id, row.storeId, row.store?.id,
      row.requester?.store_id, row.partner?.store_id,
      row.employee?.store_id
    ].map(v => (v == null ? null : Number(v)));

    return candidates.some(v => v === sid);
  };

  const cleanReason = (v, fallback = "-") => {
    if (v === null || v === undefined) return fallback;
    const s = String(v).trim();
    if (!s) return fallback;
    if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return fallback;
    return s;
  };
  const getPartnerReason = (row) =>
    cleanReason(
      row.partner_note ?? row.partner_reason ?? row.partner_reject_reason ?? row.partner_comment ?? row.note_partner,
    );

  /**
   * Factory approver utils (same as sebelumnya)…
   */
  const makeApproverUtils = (options) => {
    const { getRequesterRole, getRequesterUserId, inferApproverRole } = options;

    const getApproverName = (row) => {
      const st = normStatus(row.status);
      if (st === "rejected") {
        return firstFilled(row.rejected_by_name, row.rejectedBy?.name, row.approved_by_name, row.approvedBy?.name);
      }
      if (st === "approved") {
        return firstFilled(row.approved_by_name, row.approvedBy?.name, row.rejected_by_name, row.rejectedBy?.name);
      }
      return firstFilled(row.approved_by_name, row.approvedBy?.name);
    };

    const getApproverRole = (row) => {
      const st = normStatus(row.status);
      const anyRole = firstFilled(row.rejected_by_role, row.rejectedBy?.role, row.approved_by_role, row.approvedBy?.role);
      if (String(anyRole || "").toLowerCase() === "admin") return "admin";

      if (st === "rejected") {
        const r = firstFilled(row.rejected_by_role, row.rejectedBy?.role);
        return r || inferApproverRole(row);
      }
      if (st === "approved") {
        const r = firstFilled(row.approved_by_role, row.approvedBy?.role);
        return r || inferApproverRole(row);
      }
      return firstFilled(row.approved_by_role, row.approvedBy?.role) || inferApproverRole(row);
    };

    const approverDisplay = (row) => {
      const name = getApproverName(row);
      const role = roleLabel(getApproverRole(row));
      return firstFilled(name, role, "Approver");
    };

    const canceledByLabel = (row) => {
      const reqUserId = getRequesterUserId(row);
      const isSelf = row.canceled_by && reqUserId && Number(row.canceled_by) === Number(reqUserId);
      if (isSelf) return "Pemohon";
      const r = firstFilled(row.canceled_by_role, row.canceledBy?.role);
      return roleLabel(r || "approver");
    };

    return { getApproverName, getApproverRole, approverDisplay, canceledByLabel };
  };

  const inferApproverRoleLeave = (row) => {
    const reqRole = String(row?.employee?.role || row?.employee_role || "").toLowerCase();
    if (reqRole === "cos") return "ac";
    if (reqRole === "employee" || reqRole === "acos") return "cos";
    return "approver";
  };
  const LeaveApprover = makeApproverUtils({
    getRequesterRole:   (row) => row.employee?.role,
    getRequesterUserId: (row) => row.employee?.user_id || row.employee_user_id || row.employee_id,
    inferApproverRole:  inferApproverRoleLeave,
  });

  const inferApproverRoleSwap = (row) => {
    const reqRole = String(row?.requester?.role || row?.employee?.role || "").toLowerCase();
    if (row.approved_by && row.requester_id && Number(row.approved_by) === Number(row.requester_id)) {
      return "cos";
    }
    if (reqRole === "employee" || reqRole === "acos") return "cos";
    if (reqRole === "cos") return "admin";
    return "approver";
  };
  const SwapApprover = makeApproverUtils({
    getRequesterRole:   (row) => row.requester?.role || row.employee?.role,
    getRequesterUserId: (row) => row.requester?.user_id || row.requester_user_id || row.requester_id,
    inferApproverRole:  inferApproverRoleSwap,
  });

  // =========================
  // UTIL: normalizer & builder
  // =========================
  // === Helpers untuk tanggal ===
const toISO = (s) => {
  if (!s) return null;
  const t = String(s).slice(0,10).replace(/\//g,'-').trim();
  const m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/); // DD-MM-YYYY
  return m ? `${m[3]}-${m[2]}-${m[1]}` : t;      // YYYY-MM-DD
};

const daysInclusive = (start, end, clipStart=null, clipEnd=null) => {
  const sIso = toISO(start), eIso = toISO(end);
  if (!sIso || !eIso) return 0;
  let s = new Date(`${sIso}T00:00:00`);
  let e = new Date(`${eIso}T00:00:00`);
  const cs = toISO(clipStart), ce = toISO(clipEnd);
  if (cs) { const d = new Date(`${cs}T00:00:00`); if (s < d) s = d; }
  if (ce) { const d = new Date(`${ce}T00:00:00`); if (e > d) e = d; }
  const diff = Math.floor((e - s) / 86400000) + 1; // inklusif
  return diff > 0 ? diff : 0;
};

const buildLeaveSummary = (rows = []) => {
  const details = rows.map(r => {
    const status = String(r.status || '').toLowerCase();
    const type   = String(r.type || '').toLowerCase();

    const submitter_name = r.employee?.name || 'Pemohon';
    const approver_name  =
      r.approver?.name ||
      r.approved_by_name ||
      (r.approved_by ? 'Approver' : '');

    const nik  = r.employee?.nik || r.employee_nik || r.nik || '';
    const name = submitter_name;

    const start_date = (r.start_date || r.created_at || '').slice(0, 10);
    const end_date   = (r.end_date   || r.updated_at || '').slice(0, 10);

    // HARI: pakai dari backend kalau ada, kalau tidak hitung sendiri (inklusif & clip ke filter)
    const days =
      Number(r.days ?? r.total_days) ||
      daysInclusive(start_date, end_date, startDate || null, endDate || null);

    const baseReason     = r.reason || '';
    const rejectReason   = r.reject_reason || '';
    const canceledReason = r.cancel_reason || '';

    let keterangan = `Pengajuan ${String(r.type||"").toLowerCase()} oleh ${r.employee?.name}, `;
    if (status === "approved") {
      keterangan += `Disetujui oleh ${roleLabel(LeaveApprover.getApproverRole(r))}.`;
    } else if (status === "rejected") {
      keterangan += `Ditolak oleh ${LeaveApprover.approverDisplay(r)} : ${(r.reject_reason || '').trim()}.`;
    } else if (["canceled","cancelled","cancel","void"].includes(status)) {
      keterangan += `Dibatalkan oleh ${r.employee?.name} : ${(r.cancel_reason || '').trim()}.`;
    } else {
      keterangan += "Menunggu persetujuan.";
    }

    return {
      id: r.id,
      nik,
      name,
      type,
      status,
      start_date,
      end_date,
      days, // <-- sudah benar
      submitter_name,
      approver_name,
      reason: baseReason,
      reject_reason: rejectReason,
      canceled_reason: canceledReason,
      keterangan,
      store_id: r.store_id ?? r.employee?.store_id ?? r.store?.id ?? null,
      store_name: r.store_name ?? r.employee?.store?.store_name ?? r.store?.store_name ?? null,
    };
  });

  const per_employee_map = new Map();
  const per_type_map     = new Map();
  const per_status_map   = new Map();

  for (const d of details) {
    const key = `${(d.nik||'').trim()}|${(d.name||'').trim()}`;
    const agg = per_employee_map.get(key) || {
      nik: d.nik, name: d.name, total_leaves: 0, cuti: 0, izin: 0, sakit: 0, pending: 0, approved: 0, rejected: 0,
    };
    agg.total_leaves += 1;
    if (d.type === 'cuti')  agg.cuti  += 1;
    if (d.type === 'izin')  agg.izin  += 1;
    if (d.type === 'sakit') agg.sakit += 1;
    if (d.status === 'pending')  agg.pending  += 1;
    if (d.status === 'approved') agg.approved += 1;
    if (d.status === 'rejected') agg.rejected += 1;
    per_employee_map.set(key, agg);

    per_type_map.set(d.type,    (per_type_map.get(d.type)    || 0) + 1);
    per_status_map.set(d.status, (per_status_map.get(d.status) || 0) + 1);
  }

  return {
    per_employee: [...per_employee_map.values()],
    per_type:     [...per_type_map.entries()].map(([type,total]) => ({ type, total })),
    per_status:   [...per_status_map.entries()].map(([status,total]) => ({ status, total })),
    details
  };
};

  const buildSwapSummary = (rows = []) => {
    const details = rows.map(r => {
      const status        = String(r.status || '').toLowerCase();
      const partnerStatus = String(r.partner_status || '').toLowerCase();

      const requester_nik  = r.requester?.nik || r.requester_nik || '';
      const requester_name = r.requester?.name || r.requester_name || '';
      const partner_nik    = r.partner?.nik || r.partner_nik || '';
      const partner_name   = r.partner?.name || r.partner_name || 'Partner';

      const date = (r.date || r.created_at || '').slice(0, 10);

      const partnerNote     = r.partner_note || '';
      const approverReject  = r.reject_reason || '';
      const canceledReason  = r.cancel_reason || '';

      let keterangan = `Tukar shift ${r.requester?.name} dengan ${r.partner?.name}. `;

      if (status === "approved") {
        const approverRole = roleLabel(SwapApprover.getApproverRole(r));
        const partnerAccepted = normStatus(r.partner_status) === "accepted";
        const partnerName = r.partner?.name || r.partner_name || "Partner";
        const dateEff = fmtDate(r.date);
        if (partnerAccepted) {
          keterangan += `Disetujui oleh Partner (${partnerName}) dan ${approverRole}.`;
        } else {
          keterangan += `Disetujui oleh ${approverRole}.`;
        }
        if (dateEff) keterangan += ` Efektif ${dateEff}.`;
      } else if (
        (["declined", "rejected", "deny", "denied"].includes(normStatus(r.partner_status))) ||
        (r.rejected_by && r.partner_id && Number(r.rejected_by) === Number(r.partner_id)) ||
        !!r.partner_note
      ) {
        const pr = getPartnerReason(r);
        keterangan += `Ditolak oleh Partner (${r.partner?.name}) : ${pr}.`;
      } else if (status === "rejected") {
        const reason = cleanReason(r.reject_reason, "-");
        keterangan += `Partner ${r.partner?.name} telah menyetujui, namun ditolak oleh ${roleLabel(SwapApprover.getApproverRole(r))} : ${reason}.`;
      } else if (["canceled", "cancelled", "cancel", "void"].includes(status)) {
        const reason = cleanReason(r.cancel_reason);
        keterangan += `Dibatalkan oleh Pemohon (${r.requester?.name}) : ${reason}.`;
      } else {
        keterangan += "Menunggu persetujuan.";
      }

      return {
        id: r.id,
        requester_nik,
        requester_name,
        partner_nik,
        partner_name,
        date,
        status,
        partner_note: partnerNote,
        partner_status: partnerStatus,
        canceled_reason: canceledReason,
        keterangan,
        // NEW: info store jika ada
        store_id: r.store_id ?? r.requester?.store_id ?? r.store?.id ?? null,
        store_name: r.store_name ?? r.requester?.store?.store_name ?? r.store?.store_name ?? null,
      };
    });

    const per_status_map = new Map();
    const per_date_map   = new Map();
    for (const d of details) {
      per_status_map.set(d.status, (per_status_map.get(d.status) || 0) + 1);
      const day = d.date || '';
      per_date_map.set(day, (per_date_map.get(day) || 0) + 1);
    }

    return {
      per_status: [...per_status_map.entries()].map(([status, total]) => ({ status, total })),
      per_date:   [...per_date_map.entries()].sort((a,b)=>a[0].localeCompare(b[0]))
                  .map(([date, total_swaps]) => ({ date, total_swaps })),
      details
    };
  };

  // ======================================
  // ====== LOAD STORES (untuk filter) ====
  // ======================================
const normalizeStores = (raw) => {
  if (!raw) return [];
  // kemungkinan bentuk respons:
  // { data: { data: [...] } } | { data: [...] } | [...] | { stores: [...] }
  const arr =
    raw?.data?.data ||
    raw?.data ||
    raw?.stores ||
    raw;

  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => {
      const id =
        s?.id ?? s?.store_id ?? s?.ID ?? null;
      const name =
        s?.store_name ?? s?.name ?? s?.storeName ?? s?.nama ?? null;
      const code = s?.store_code ?? s?.code ?? null;
      return id ? { id: Number(id), store_name: name || (code ? `Store ${code}` : `Store #${id}`), store_code: code } : null;
    })
    .filter(Boolean);
};

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingStores(true);
      try {
        let list = null;

        // 1) coba pakai scheduleAPI jika ada
        if (scheduleAPI?.getStores) {
          try {
            const res = await scheduleAPI.getStores();
            list = normalizeStores(res);
          } catch {}
        }

        // 2) fallback: panggil endpoint manual
        if (!list || !list.length) {
          const api = (await import('@/config/api')).default;
          // SESUAIKAN path-nya dengan backend kamu, boleh /stores, /api/stores, dll.
          const res = await api.get('/stores');
          list = normalizeStores(res);
        }

        if (mounted) {
          setStores(list || []);
          // jika COS/ACOS: auto-set store pertama biar langsung terfilter
          if (!(String(user?.role || '').toLowerCase() === 'admin' || String(user?.role || '').toLowerCase() === 'ac')) {
            if (list?.length && !selectedStoreId) {
              setSelectedStoreId(String(list[0].id));
            }
          }
        }
      } catch (e) {
        if (mounted) setStores([]);
        console.warn('Gagal memuat stores:', e);
      } finally {
        mounted && setLoadingStores(false);
      }
    })();
    return () => { mounted = false; };
  }, [scheduleAPI]); // jangan lupa dependencynya

  // ======================================
  // ====== LOAD DATA (respect filters) ===
  // ======================================
  useEffect(() => {
    let mounted = true;

    // NEW: helper untuk kirim params filter ke backend
const buildParams = () => {
  const p = {};
  if (startDate) p.start_date = startDate;
  if (endDate)   p.end_date   = endDate;
  if (selectedStoreId) p.store_id = selectedStoreId;
  return p;
};


    // NEW: filter fallback client-side jika backend belum support
    const clientFilter = (rows, dateFieldCandidates = ['date', 'schedule_date', 'start_date'], storeFieldCandidates = ['store_id']) => {
      if (!Array.isArray(rows)) return [];

      const getDateFromRow = (r) => {
        for (const f of dateFieldCandidates) {
          if (r?.[f]) return r[f];
        }
        // kasus leave: gunakan start_date / created_at jika ada
        return r?.created_at || r?.updated_at || '';
      };

      const passes = rows.filter(r => {
        const d = getDateFromRow(r);
        if (!isWithinRange(d, startDate || null, endDate || null)) return false;
        if (!matchStore(r, selectedStoreId || null)) return false;
        return true;
      });
      return passes;
    };

    const load = async () => {
      // ketika tanggal belum dipilih sama sekali, biarkan semua (atau bisa default bulan berjalan)
      // di sini kita tetap fetch dan tidak memaksa tanggal default.
      try {

        // SHIFT
let shiftSum = null;

// 1) Coba pakai ringkasan backend kalau ada
if (scheduleAPI.getShiftSummary) {
  try { shiftSum = await scheduleAPI.getShiftSummary(buildParams()); } catch {}
}

// Helper: nilai summary “kosong/jelek” → pakai fallback
const isBadSummary = (sum) => {
  if (!sum) return true;
  const arr = Array.isArray(sum.per_employee) ? sum.per_employee : [];
  if (!arr.length) return true;
  // kalau semua total = 0 juga dianggap jelek
  const totalAll = arr.reduce((t, x) => t + (Number(x.total_shifts || 0)), 0);
  return totalAll === 0;
};

// 2) Jika ringkasan kosong/0 → Fallback hitung dari getScheduleLists (LIVE)
if (isBadSummary(shiftSum)) {
  // Admin: kalau belum pilih store (“Semua Store”) → kosongkan laporan
  if (!selectedStoreId) {
    mounted && setShift({ per_employee: [], per_date: [], per_store: [] });
  } else {
    const { y, m } = getYearMonthFromFilters();
    const glParams = { store_id: selectedStoreId, year: y, month: m + 1 };
    const res = await scheduleAPI.getScheduleLists(glParams);
    const rawData = res?.data;

    let rows = [];
    if (Array.isArray(rawData)) rows = rawData;
    else if (rawData && typeof rawData === 'object') rows = Object.values(rawData);

    if (!rows.length) {
      mounted && setShift({ per_employee: [], per_date: [], per_store: [] });
    } else {
      // daftar tanggal bulan, dipotong oleh filter jika ada
      const monthDates = buildMonthDates(y, m, startDate || null, endDate || null);

      const per_employee_map = new Map();
      const per_date_map = new Map();
      let totalShiftsAll = 0;

      const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };
      const normCode = (v) => (v == null ? '-' : String(v).trim().toUpperCase());

      for (const { employee = {}, schedule = {} } of rows) {
        const nik  = employee?.nik || '';
        const name = employee?.name || '';
        const key  = `${nik}|${name}`;

        const agg = per_employee_map.get(key) || {
          nik, name, pagi: 0, siang: 0, malam: 0, off: 0, none: 0, total_shifts: 0
        };

        for (const iso of monthDates) {
          const day  = Number(iso.slice(-2));
          const code = normCode(schedule?.[day]?.shift?.shift_code);

          if (code === 'P') { inc(agg, 'pagi');  inc(agg, 'total_shifts'); per_date_map.set(iso, (per_date_map.get(iso) || 0) + 1); totalShiftsAll += 1; }
          else if (code === 'S') { inc(agg, 'siang'); inc(agg, 'total_shifts'); per_date_map.set(iso, (per_date_map.get(iso) || 0) + 1); totalShiftsAll += 1; }
          else if (code === 'M') { inc(agg, 'malam'); inc(agg, 'total_shifts'); per_date_map.set(iso, (per_date_map.get(iso) || 0) + 1); totalShiftsAll += 1; }
          else if (code === 'O') { inc(agg, 'off'); }   // tidak menambah total
          else { inc(agg, 'none'); }                    // '-' tidak menambah total
        }

        // Simpan hanya jika karyawan punya P/S/M pada rentang
        if (agg.total_shifts > 0) per_employee_map.set(key, agg);
      }

      // per_store hanya saat store dipilih
      let per_store = [];
      if (selectedStoreId) {
        const storeMeta = (selectableStores || stores || []).find(s => Number(s.id) === Number(selectedStoreId));
        const storeName = storeMeta?.store_name || 'Store';
        per_store = [{ store_name: storeName, total_shifts: totalShiftsAll }];
      }

      shiftSum = {
        per_employee: [...per_employee_map.values()],
        per_date: monthDates.map(iso => ({ schedule_date: iso, total_shifts: per_date_map.get(iso) || 0 })),
        per_store,
      };
      mounted && setShift(shiftSum);
    }
  }
} else {
  // jika backend memberi data valid → tetap pakai
  mounted && setShift(shiftSum || { per_employee: [], per_date: [], per_store: [] });
}


        // LEAVE
        let leaveData = null;
        if (scheduleAPI.getLeaveSummary) {
          try { leaveData = await scheduleAPI.getLeaveSummary(buildParams()); } catch {}
        }
        if (!leaveData) {
          const raw =
            (await scheduleAPI.getLeaveList?.(buildParams())) ||
            (await import('@/config/api').then(({default:api}) =>
              api.get('/leave-requests', { params: buildParams() }).then(r=>r.data)
            ));

          const rows = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
          const filteredRows = clientFilter(rows, ['start_date', 'created_at']);
          leaveData = buildLeaveSummary(filteredRows);
        }
        mounted && setLeave({ ...leaveData, details: leaveData?.details || [] });

        // SWAP
        let swapData = null;
        if (scheduleAPI.getSwapSummary) {
          try { swapData = await scheduleAPI.getSwapSummary(buildParams()); } catch {}
        }
        if (!swapData) {
          const raw =
            (await scheduleAPI.getSwapList?.(buildParams())) ||
            (await import('@/config/api').then(({ default: api }) =>
              api.get('/shift-swaps', { params: buildParams() }).then(r => r.data)
            ));
          const rows = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
          const filteredRows = clientFilter(rows, ['date', 'created_at']);
          swapData = buildSwapSummary(filteredRows);
        }
        mounted && setSwap({ ...swapData, details: swapData?.details || [] });

      } catch (e) {
        console.error('Report load error:', e);
        if (mounted) {
          setShift({ per_employee:[], per_date:[], per_store:[] });
          setLeave({ per_employee:[], per_type:[], per_status:[], details:[] });
          setSwap({ per_status:[], per_date:[], details:[] });
        }
      }
    };

    load();
    return () => { mounted = false; };
  }, [scheduleAPI, startDate, endDate, selectedStoreId]); // NEW: depend on filters

  // ====== FILTER (search by text) ======
  const f = (s='') => s.toString().toLowerCase().includes(filterText.toLowerCase());

  const filteredShiftEmployees = useMemo(() => {
    const items = shift?.per_employee || [];
    if (!filterText) return items;
    return items.filter(it => f(it.nik) || f(it.name));
  }, [shift, filterText]);

  const filteredLeaveEmployees = useMemo(() => {
    const items = leave?.per_employee || [];
    if (!filterText) return items;
    return items.filter(it => f(it.nik) || f(it.name));
  }, [leave, filterText]);

  const filteredLeaveDetails = useMemo(() => {
    const items = leave?.details || [];
    if (!filterText) return items;
    return items.filter(it => f(it.nik) || f(it.name) || f(it.type) || f(it.status));
  }, [leave, filterText]);

  const statusOrder = {
    approved: 1,
    rejected_accept: 2,
    rejected_decline: 3,
    canceled: 4,
  };
  const categorizeSwap = (row) => {
    const status = normStatus(row.status);
    const partner = normStatus(row.partner_status);
    if (status === "approved") return "approved";
    if (status === "rejected" && partner === "accepted") return "rejected_accept";
    if (partner === "declined") return "rejected_decline";
    if (["canceled","cancelled","cancel","void"].includes(status)) return "canceled";
    return "canceled";
  };

  const filteredSwapDetails = useMemo(() => {
    const items = swap?.details || [];
    let results = items;

    if (filterText) {
      results = items.filter(it =>
        f(it.requester_nik) ||
        f(it.requester_name) ||
        f(it.partner_nik) ||
        f(it.partner_name) ||
        f(it.status)
      );
    }
    return results.sort((a, b) => {
      const catA = categorizeSwap(a);
      const catB = categorizeSwap(b);
      return (statusOrder[catA] || 99) - (statusOrder[catB] || 99);
    });
  }, [swap, filterText]);

  // ====== CHART DATA ======
  const shiftEmployeeBar = useMemo(() => {
    const list = shift?.per_employee || [];
    return {
      labels: list.map(v => `${v.name || 'Emp'} (${v.nik})`),
      datasets: [{
        label: 'Total Shift per Karyawan',
        data: list.map(v => (v.pagi || 0) + (v.siang || 0) + (v.malam || 0)),
        backgroundColor: '#4f46e5'
      }],
    };
  }, [shift]);

  const shiftDailyLine = useMemo(() => ({
    labels: (shift?.per_date || []).map(v => v.schedule_date),
    datasets: [{ label: 'Shift Harian', data: (shift?.per_date || []).map(v => v.total_shifts || 0), backgroundColor: '#10b981', borderColor: '#10b981' }],
  }), [shift]);

  const shiftStorePie = useMemo(() => ({
    labels: (shift?.per_store || []).map(v => v.store_name),
    datasets: [{ label: 'Shift per Toko', data: (shift?.per_store || []).map(v => v.total_shifts || 0), backgroundColor: ['#f59e0b','#8b5cf6','#06b6d4','#ef4444','#22c55e','#0ea5e9'] }],
  }), [shift]);

  const leaveTypeDoughnut = useMemo(() => ({
    labels: (leave?.per_type || []).map(v => (v.type || '').toUpperCase()),
    datasets: [{ label: 'Total per Jenis', data: (leave?.per_type || []).map(v => v.total || 0), backgroundColor: ['#0ea5e9','#22c55e','#ef4444'] }],
  }), [leave]);

  const leaveStatusPie = useMemo(() => ({
    labels: (leave?.per_status || []).map(v => v.status),
    datasets: [{ label: 'Status', data: (leave?.per_status || []).map(v => v.total || 0), backgroundColor: ['#f59e0b','#22c55e','#ef4444'] }],
  }), [leave]);

  const swapStatusPie = useMemo(() => ({
    labels: (swap?.per_status || []).map(v => v.status),
    datasets: [{ label: 'Status Tukar Shift', data: (swap?.per_status || []).map(v => v.total || 0), backgroundColor: ['#f59e0b','#22c55e','#ef4444','#6b7280'] }],
  }), [swap]);

  const swapDailyLine = useMemo(() => ({
    labels: (swap?.per_date || []).map(v => v.date),
    datasets: [{ label: 'Tukar Shift per Hari', data: (swap?.per_date || []).map(v => v.total_swaps || 0), backgroundColor: '#6366f1', borderColor: '#6366f1' }],
  }), [swap]);

  // ====== EXPORT ======
const exportShiftExcel = () => {
  const rows = (shift?.per_employee || []).map(it => ({
    NIK: it.nik,
    Nama: it.name || '-',
    Pagi: it.pagi ?? 0,
    Siang: it.siang ?? 0,
    Malam: it.malam ?? 0,
    Off: it.off ?? 0,
    'Cuti / Izin / Sakit': it.none ?? 0, // <-- ambil dari backend
    'Total Shift': it.total_shifts ?? ((it.pagi||0) + (it.siang||0) + (it.malam||0)),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Shift - Per Employee');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shift?.per_date || []),  'Shift - Per Date');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shift?.per_store || []), 'Shift - Per Store');
  XLSX.writeFile(wb, 'shift-report.xlsx');
};

  const exportLeaveExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leave?.per_employee || []), 'Leave - Per Employee');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leave?.per_type || []),     'Leave - Per Type');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leave?.per_status || []),   'Leave - Per Status');
    const detailRows = (leave?.details || []).map(it => ({
      NIK: it.nik,
      Nama: it.name,
      Jenis: (it.type || '').toUpperCase(),
      Status: it.status,
      Mulai: it.start_date,
      Selesai: it.end_date,
      Hari: it.days,
      Alasan: it.reason || '',
      Keterangan: it.keterangan || '',
      Store: it.store_name || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Leave - Details');
    XLSX.writeFile(wb, 'leave-report.xlsx');
  };
  const exportSwapExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(swap?.per_status || []), 'Swap - Per Status');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(swap?.per_date || []),   'Swap - Per Date');
    const detailRows = (swap?.details || []).map(it => ({
      ID: it.id,
      Requester: `${it.requester_name} (${it.requester_nik})`,
      Partner: `${it.partner_name} (${it.partner_nik})`,
      Tanggal: it.date,
      Status: it.status,
      Keterangan: it.keterangan || '',
      Store: it.store_name || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Swap - Details');
    XLSX.writeFile(wb, 'swap-report.xlsx');
  };

    // Nama store milik user (COS/ACOS). Jika lebih dari satu, digabung.
const myStoreLabel = useMemo(() => {
  if (canSelectAnyStore) return '';
  if (!selectableStores?.length) {
    return user?.store?.store_name || user?.store_name || '-';
  }
  const names = selectableStores.map(s => s.store_name || s.name || `Store #${s.id}`);
  return names.join(', ');
}, [canSelectAnyStore, selectableStores, user]);

// Auto-set store untuk COS/ACOS (biar filter langsung sesuai tokonya)
useEffect(() => {
  if (!canSelectAnyStore) {
    if (selectableStores.length === 1) {
      setSelectedStoreId(String(selectableStores[0].id));
    } else if (selectableStores.length > 1 && !selectedStoreId) {
      setSelectedStoreId(String(selectableStores[0].id)); // default ambil pertama
    }
  }
}, [canSelectAnyStore, selectableStores, selectedStoreId]);


  // ====== LOADING ======
  if (!shift || !leave || !swap) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {TABS.map(t => <Skeleton key={t.key} width={160} height={36} />)}
          <div className="ml-auto"><Skeleton width={320} height={36} /></div>
        </div>
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 border"><Skeleton /></th>
                <th className="px-4 py-2 border"><Skeleton /></th>
                <th className="px-4 py-2 border"><Skeleton /></th>
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 border"><Skeleton /></td>
                  <td className="px-4 py-2 border"><Skeleton /></td>
                  <td className="px-4 py-2 border"><Skeleton /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ====== batas default 15 karakter ======
  const isLong = (s, limit = 15) => (s ?? '').toString().length > limit;
  const shortText = (s, limit = 15) => {
    const t = (s ?? '').toString();
    if (!t) return '-';
    return t.length > limit ? t.slice(0, limit) + '...' : t;
  };

  const showFull = (title, text) => {
    const t = (text ?? '').toString().trim();
    if (!t || t === '-') return;
    Swal.fire({
      title,
      html: `<div style="text-align:left;white-space:pre-wrap">${t}</div>`,
      icon: 'info',
      confirmButtonText: 'Tutup',
    });
  };

  // ====== RENDER ======
  return (
    <div className="space-y-8">
      {/* Toolbar: Tabs + Filter + Export */}
      <div className="space-y-3">
        {/* Baris 1: Cari | Tgl Awal | Tgl Akhir | Store */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          {/* Cari NIK/Nama */}
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cari NIK / Nama
            </label>
            <input
              type="search"
              placeholder="Ketik NIK atau Nama…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full border px-3 py-2 rounded-md text-sm"
            />
          </div>

          {/* Tanggal Awal */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Awal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border px-3 py-2 rounded-md text-sm"
            />
          </div>

          {/* Tanggal Akhir */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border px-3 py-2 rounded-md text-sm"
            />
          </div>

          {/* Store: dropdown untuk Admin/AC, label untuk COS/ACOS */}
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nama Store</label>
            // Saat render filter
            {canSelectAnyStore ? (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full border px-3 py-2 rounded-md text-sm"
                disabled={loadingStores}
              >
                <option value="">{loadingStores ? 'Memuat Store…' : 'Semua Store'}</option>
                {(stores || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 rounded-md text-sm border bg-gray-50 text-gray-700">
                {myStoreLabel || '-'}
              </div>
            )}
          </div>
          <div className="md:col-span-1 flex">
          <button
            type="button"
            title="Reset Filter"
            onClick={resetFilters}
            disabled={!isFilterActive}
            className={`flex items-center gap-1 px-[1.45rem] py-[0.625rem] rounded border text-sm ${
              isFilterActive
                ? 'bg-white hover:bg-gray-50 text-gray-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          </div>
        </div>

        {/* Baris 2: Tabs | Export (kanan) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 rounded-md text-sm border ${
                  activeTab === t.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white hover:bg-gray-50'
                }`}
                aria-pressed={activeTab === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="ml-auto">
            {activeTab === 'shift' && (
              <button
                onClick={exportShiftExcel}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                Export Shift
              </button>
            )}
            {activeTab === 'leave' && (
              <button
                onClick={exportLeaveExcel}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                Export Leave
              </button>
            )}
            {activeTab === 'swap' && (
              <button
                onClick={exportSwapExcel}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                Export Swap
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SHIFT */}
      {activeTab === 'shift' && (
        <div className="space-y-8">
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-center">NIK</th>
                  <th className="px-4 py-2 border text-center">Nama</th>
                  <th className="px-4 py-2 border text-center">Pagi</th>
                  <th className="px-4 py-2 border text-center">Siang</th>
                  <th className="px-4 py-2 border text-center">Malam</th>
                  <th className="px-4 py-2 border text-center">Off</th>
                  <th className="px-4 py-2 border text-center">Cuti / Izin / Sakit</th>
                  <th className="px-4 py-2 border text-center">Total Shift</th>
                </tr>
              </thead>
              <tbody>
                {(filteredShiftEmployees || []).map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{item.nik}</td>
                    <td className="px-4 py-2 border text-center">{item.name || '-'}</td>
                    <td className="px-4 py-2 border text-center">{item.pagi  ?? 0}</td>
                    <td className="px-4 py-2 border text-center">{item.siang ?? 0}</td>
                    <td className="px-4 py-2 border text-center">{item.malam ?? 0}</td>
                    <td className="px-4 py-2 border text-center">{item.off   ?? 0}</td>
                    <td className="px-4 py-2 border text-center">{item.none  ?? 0}</td>
                    <td className="px-4 py-2 border text-center">
                      {(Number(item.pagi) || 0) + (Number(item.siang) || 0) + (Number(item.malam) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">Total Shift per Karyawan</h3>
              <Bar data={shiftEmployeeBar} height={200} />
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">
                Shift Harian
                {startDate || endDate ? (
                  <span className="ml-2 text-xs text-gray-500">
                    ({toISODate(startDate) || 'awal'} s/d {toISODate(endDate) || 'akhir'})
                  </span>
                ) : null}
              </h3>
              <Line data={shiftDailyLine} height={200} />
            </div>
            <div className="bg-white p-4 rounded shadow md:col-span-2">
              <h3 className="text-base font-semibold mb-2">Shift per Toko</h3>
              <Pie data={shiftStorePie} height={180} />
            </div>
          </div>
        </div>
      )}

      {/* LEAVE */}
      {activeTab === 'leave' && (
        <div className="space-y-8">
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-center">NIK</th>
                  <th className="px-4 py-2 border text-center">Nama</th>
                  <th className="px-4 py-2 border text-center">Cuti</th>
                  <th className="px-4 py-2 border text-center">Izin</th>
                  <th className="px-4 py-2 border text-center">Sakit</th>
                  <th className="px-4 py-2 border text-center">Total</th>
                  <th className="px-4 py-2 border text-center">Pending</th>
                  <th className="px-4 py-2 border text-center">Approved</th>
                  <th className="px-4 py-2 border text-center">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {(filteredLeaveEmployees || []).map((it, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{it.nik}</td>
                    <td className="px-4 py-2 border text-center">{it.name || '-'}</td>
                    <td className="px-4 py-2 border text-center">{it.cuti || 0}</td>
                    <td className="px-4 py-2 border text-center">{it.izin || 0}</td>
                    <td className="px-4 py-2 border text-center">{it.sakit || 0}</td>
                    <td className="px-4 py-2 border text-center">{it.total_leaves || ((it.cuti||0)+(it.izin||0)+(it.sakit||0))}</td>
                    <td className="px-4 py-2 border text-center">{it.pending || 0}</td>
                    <td className="px-4 py-2 border text-center">{it.approved || 0}</td>
                    <td className="px-4 py-2 border text-center">{it.rejected || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-center">NIK</th>
                  <th className="px-4 py-2 border text-center">Nama</th>
                  <th className="px-4 py-2 border text-center">Jenis</th>
                  <th className="px-4 py-2 border text-center">Status</th>
                  <th className="px-4 py-2 border text-center">Mulai</th>
                  <th className="px-4 py-2 border text-center">Selesai</th>
                  <th className="px-4 py-2 border text-center">Hari</th>
                  <th className="px-4 py-2 border text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {(filteredLeaveDetails || []).map((it, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{it.nik}</td>
                    <td className="px-4 py-2 border text-center">{it.name || '-'}</td>
                    <td className="px-4 py-2 border text-center">{(it.type || '').toLowerCase()}</td>
                    <td className="px-4 py-2 border text-center">{it.status}</td>
                    <td className="px-4 py-2 border text-center">{it.start_date}</td>
                    <td className="px-4 py-2 border text-center">{it.end_date}</td>
                    <td className="px-4 py-2 border text-center">{it.days}</td>
                    <td className="px-4 py-2 border text-center">
                      {isLong(it.keterangan, 15) ? (
                        <button
                          type="button"
                          onClick={() => showFull('Keterangan', it.keterangan)}
                          className="text-black-600 hover:text-blue-800 underline decoration-dotted"
                          title={it.keterangan}
                        >
                          {shortText(it.keterangan, 15)}
                        </button>
                      ) : (it.keterangan || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">Cuti/Izin/Sakit per Jenis</h3>
              <Doughnut data={leaveTypeDoughnut} height={200} />
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">Status Pengajuan</h3>
              <Pie data={leaveStatusPie} height={200} />
            </div>
          </div>
        </div>
      )}

      {/* SWAP */}
      {activeTab === 'swap' && (
        <div className="space-y-8">
          <div className="overflow-x-auto border rounded-md">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-center">Requester</th>
                  <th className="px-4 py-2 border text-center">Partner</th>
                  <th className="px-4 py-2 border text-center">Tanggal</th>
                  <th className="px-4 py-2 border text-center">Status</th>
                  <th className="px-4 py-2 border text-center">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {(filteredSwapDetails || []).map((it, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 border text-center">{it.requester_name || '-'} ({it.requester_nik})</td>
                    <td className="px-4 py-2 border text-center">{it.partner_name || '-'} ({it.partner_nik})</td>
                    <td className="px-4 py-2 border text-center">{it.date}</td>
                    <td className="px-4 py-2 border text-center">{it.status}</td>
                    <td className="px-4 py-2 border text-center">
                      {isLong(it.keterangan, 15) ? (
                        <button
                          type="button"
                          onClick={() => showFull('Keterangan', it.keterangan)}
                          className="text-black-600 hover:text-blue-800 underline decoration-dotted"
                          title={it.keterangan}
                        >
                          {shortText(it.keterangan, 12)}
                        </button>
                      ) : (it.keterangan || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">Status Tukar Shift</h3>
              <Pie data={swapStatusPie} height={200} />
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-base font-semibold mb-2">Trend Tukar Shift Harian</h3>
              <Line data={swapDailyLine} height={200} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDashboard;

// src/components/dashboard/SwapForm.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useShiftSwaps, useEmployees } from "@/context";
import api from "@/config/api";

const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const parseLocalYMD = (s) => {
  const [y, m, d] = (s || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export default function SwapForm() {
  const { submitSwap } = useShiftSwaps();
  const { employees = [], loading: loadingEmp } = useEmployees();

  const [form, setForm] = useState({ partner_id: "", date: "" });
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // batas minimal tanggal = BESOK (tidak boleh hari ini/kemarin)
  const minDateStr = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return toYMD(tomorrow);
  }, []);

  function handleChange(e) {
    setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  }

  // Preview shift requester & partner untuk tanggal + partner
  useEffect(() => {
    const { partner_id, date } = form;
    if (!partner_id || !date) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingPreview(true);
        const res = await api.get("/shift-swaps/preview", { params: { partner_id, date } });
        if (!cancelled) setPreview(res.data);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.partner_id, form.date]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validasi tanggal > hari ini (minimal besok)
    const picked = parseLocalYMD(form.date);
    const tomorrow = parseLocalYMD(minDateStr);
    if (!picked || picked < tomorrow) {
      setError("Tanggal tukar minimal besok. Tidak boleh hari ini atau sebelumnya.");
      setLoading(false);
      setTimeout(() => setError(""), 2000);
      return;
    }

    try {
      await submitSwap({ partner_id: form.partner_id, date: form.date }); // hanya 2 field
      setSuccess("Pengajuan tukar shift berhasil.");
      setForm({ partner_id: "", date: "" });
      setPreview(null);
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Gagal mengajukan tukar shift");
      setTimeout(() => setError(""), 2000);
    } finally {
      setLoading(false);
    }
  }

  const isPreviewReady = Boolean(preview?.requester?.shift && preview?.partner?.shift);

  const labelOf = (emp) => {
    if (!emp) return "";
    const name = emp.name || emp.fullname || emp.employee_name || "";
    const nik = emp.nik || emp.employee_nik || "";
    return nik ? `${name} (${nik})` : name;
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md p-4 rounded mb-6">
      <h2 className="text-lg font-semibold mb-3">Ajukan Tukar Shift</h2>

      {error && <p className="text-red-500 mb-3">{error}</p>}
      {success && <p className="text-green-600 mb-3">{success}</p>}

      {/* Partner (nama) */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
      <select
        name="partner_id"
        value={form.partner_id}
        onChange={handleChange}
        className="border p-2 w-full mb-3 rounded"
        required
        disabled={loadingEmp}
      >
        <option value="">{loadingEmp ? "Memuat karyawan..." : "Pilih Partner…"}</option>
        {employees?.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {labelOf(emp)}
          </option>
        ))}
      </select>

      {/* Tanggal */}
      <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
      <input
        type="date"
        name="date"
        value={form.date}
        onChange={handleChange}
        min={minDateStr} // <-- cegah pilih hari ini/kemarin di UI
        required
        className="border p-2 w-full rounded"
      />
      <div className="text-xs text-gray-500 mt-1 mb-3">Tanggal minimal: {minDateStr}</div>

      {/* Preview shift (read-only) */}
      {form.partner_id && form.date && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Shift Pemohon</div>
            {loadingPreview ? (
              <div className="text-sm text-gray-500">Memuat…</div>
            ) : (
              <>
                <div className="text-sm font-medium">{preview?.requester?.shift?.name || "-"}</div>
                <div className="text-xs text-gray-500">{preview?.requester?.shift?.code || ""}</div>
              </>
            )}
          </div>
          <div className="border rounded p-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">Shift Partner</div>
            {loadingPreview ? (
              <div className="text-sm text-gray-500">Memuat…</div>
            ) : (
              <>
                <div className="text-sm font-medium">{preview?.partner?.shift?.name || "-"}</div>
                <div className="text-xs text-gray-500">{preview?.partner?.shift?.code || ""}</div>
              </>
            )}
          </div>
        </div>
      )}

      {form.partner_id && form.date && !loadingPreview && !isPreviewReady && (
        <p className="text-amber-600 text-sm mb-4">
          Jadwal salah satu karyawan belum tersedia pada tanggal ini. Silakan pilih tanggal lain.
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !form.partner_id || !form.date || !isPreviewReady}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Mengirim..." : "Ajukan"}
      </button>
    </form>
  );
}

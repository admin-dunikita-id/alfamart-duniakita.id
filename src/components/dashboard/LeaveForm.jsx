import React, { useMemo, useState, useEffect } from "react";
import api from "@/config/api"; // kalau createRequest sudah ada di context, boleh pakai itu

// util: Date ⇄ "YYYY-MM-DD"
const toYMD = (d) => {
  if (!(d instanceof Date)) return "";
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

export default function LeaveForm() {
  const [form, setForm] = useState({
    type: "izin",        // izin | cuti | sakit
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");

  // === batas minimal start_date (izin/sakit = H+1, cuti = H+7)
  const minStartStr = useMemo(() => {
    const today = new Date();
    const lead = form.type === "cuti" ? 7 : 1;
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + lead);
    return toYMD(min);
  }, [form.type]);

  // === jaga end_date minimal = start_date (kalau user ganti start, kita sesuaikan end)
  useEffect(() => {
    if (!form.start_date) return;
    if (!form.end_date || form.end_date < form.start_date) {
      setForm((s) => ({ ...s, end_date: s.start_date }));
    }
  }, [form.start_date]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // ===== Validasi di FE (UX) — backend tetap jadi polisi utama =====
    const start = parseLocalYMD(form.start_date);
    const end   = parseLocalYMD(form.end_date);
    const today = new Date(); today.setHours(0,0,0,0);

    if (!start || !end) {
      setError("Tanggal mulai & selesai wajib diisi.");
      setLoading(false);
      return;
    }
    if (start > end) {
      setError("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      setLoading(false);
      return;
    }

    // aturan lead-time
    const lead = form.type === "cuti" ? 7 : 1;
    const minStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + lead);
    if (start < minStart) {
      setError(
        form.type === "cuti"
          ? "Cuti hanya bisa diajukan minimal 7 hari dari hari ini."
          : "Izin/Sakit hanya bisa diajukan mulai besok."
      );
      setLoading(false);
      return;
    }

    // payload ke API (YYYY-MM-DD)
    const payload = {
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || "",
    };

    try {
      // Jika kamu punya context: const result = await createRequest(payload)
      // Di sini langsung ke API (silakan ganti ke context kalau ada):
      const res = await api.post("/leave-requests", payload);
      setSuccess(res.data?.message || "Pengajuan berhasil dikirim.");
      setForm({ type: "izin", start_date: "", end_date: "", reason: "" });
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Gagal mengajukan izin/cuti/sakit.";
      setError(msg);
      setTimeout(() => setError(""), 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md p-4 rounded mb-6">
      <h2 className="text-lg font-semibold mb-2">Ajukan Izin / Cuti / Sakit</h2>

      {error && <p className="text-red-500 mb-3">{error}</p>}
      {success && <p className="text-green-600 mb-3">{success}</p>}

      {/* Jenis */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Jenis</label>
        <select
          name="type"
          value={form.type}
          onChange={(e) => {
            // reset tanggal saat ganti tipe supaya patuh min-date baru
            setForm({ type: e.target.value, start_date: "", end_date: "", reason: "" });
          }}
          className="border p-2 w-full rounded"
          required
        >
          <option value="izin">Izin</option>
          <option value="cuti">Cuti</option>
          <option value="sakit">Sakit</option>
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {form.type === "cuti"
            ? "Cuti: minimal mulai H+7 dari hari ini."
            : "Izin/Sakit: minimal mulai besok (H+1)."}
        </p>
      </div>

      {/* Tanggal mulai */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
        <input
          type="date"
          name="start_date"
          value={form.start_date}
          onChange={handleChange}
          min={minStartStr}      // <-- batas minimal sesuai tipe
          className="border p-2 w-full rounded"
          required
        />
      </div>

      {/* Tanggal selesai */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Tanggal Selesai</label>
        <input
          type="date"
          name="end_date"
          value={form.end_date}
          onChange={handleChange}
          min={form.start_date || minStartStr}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      <div className="text-xs text-gray-500 mt-1">
          Tanggal minimal: {minStartStr}
      </div>

      {/* Alasan */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Alasan</label>
        <textarea
          name="reason"
          value={form.reason}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          placeholder="(opsional)"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !form.start_date || !form.end_date}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Mengirim..." : "Ajukan"}
      </button>
    </form>
  );
}

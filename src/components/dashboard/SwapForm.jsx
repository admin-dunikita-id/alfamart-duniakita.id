import React, { useState } from "react";
import { useShiftSwaps } from "@/context";

export default function SwapForm() {
  const { submitSwap } = useShiftSwaps();
  const [form, setForm] = useState({
    partner_id: "",
    date: "",
    requester_shift_id: "",
    partner_shift_id: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await submitSwap(form);
      setSuccess("Pengajuan tukar shift berhasil.");
      setForm({
        partner_id: "",
        date: "",
        requester_shift_id: "",
        partner_shift_id: "",
      });
    } catch (err) {
      setError(err.msg || "Gagal mengajukan tukar shift");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md p-4 rounded mb-6">
      <h2 className="text-lg font-semibold mb-2">Ajukan Tukar Shift</h2>

      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-500 mb-2">{success}</p>}

      <input type="number" name="partner_id" value={form.partner_id} onChange={handleChange} placeholder="Partner ID" required className="border p-2 w-full mb-3 rounded" />
      <input type="date" name="date" value={form.date} onChange={handleChange} required className="border p-2 w-full mb-3 rounded" />
      <input type="number" name="requester_shift_id" value={form.requester_shift_id} onChange={handleChange} placeholder="Shift Pemohon ID" className="border p-2 w-full mb-3 rounded" />
      <input type="number" name="partner_shift_id" value={form.partner_shift_id} onChange={handleChange} placeholder="Shift Partner ID" className="border p-2 w-full mb-3 rounded" />

      <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400">
        {loading ? "Mengirim..." : "Ajukan"}
      </button>
    </form>
  );
}

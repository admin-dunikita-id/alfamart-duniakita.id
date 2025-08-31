import React, { useState } from "react";
import { useLeaveRequests } from "@/context";

export default function LeaveForm() {
  const { createRequest } = useLeaveRequests();

  const [form, setForm] = useState({
    type: "izin",
    start_date: "",
    end_date: "",
    reason: "",
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

    const result = await createRequest(form);
    if (result.success) {
      setSuccess("Pengajuan berhasil dikirim.");
      setForm({ type: "izin", start_date: "", end_date: "", reason: "" });
    } else {
      setError(result.message);
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md p-4 rounded mb-6">
      <h2 className="text-lg font-semibold mb-2">Ajukan Izin / Cuti / Sakit</h2>

      {error && <p className="text-red-500 mb-2">{error}</p>}
      {success && <p className="text-green-500 mb-2">{success}</p>}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Jenis</label>
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        >
          <option value="izin">Izin</option>
          <option value="cuti">Cuti</option>
          <option value="sakit">Sakit</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
        <input
          type="date"
          name="start_date"
          value={form.start_date}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Tanggal Selesai</label>
        <input
          type="date"
          name="end_date"
          value={form.end_date}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Alasan</label>
        <textarea
          name="reason"
          value={form.reason}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Mengirim..." : "Ajukan"}
      </button>
    </form>
  );
}

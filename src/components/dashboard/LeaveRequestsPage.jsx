import React, { useEffect, useState } from "react";
import { useAuth, useLeaveRequests } from "@/context";
import LeaveForm from "./LeaveForm";

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const { list, loading, error, fetchList, approveRequest } = useLeaveRequests();
  const [loadingRows, setLoadingRows] = useState({}); // key = leave id
  const [successMessage, setSuccessMessage] = useState(""); // <-- untuk alert info

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAction = async (id, action) => {
    setLoadingRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [action]: true }
    }));

    const result = await approveRequest(id, action);

    setLoadingRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [action]: false }
    }));

    if (result.success) {
      setSuccessMessage(`Pengajuan berhasil ${action === "approve" ? "diapprove" : "ditolak"}!`);
      // hilangkan pesan setelah 3 detik
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Izin / Cuti / Sakit</h1>

      {error && <p className="text-red-500 mb-2">{error}</p>}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded mb-2">
          {successMessage}
        </div>
      )}
      {user.role !== "cos" && loading && <p>Loading...</p>}

      {/* Form hanya muncul jika bukan COS */}
      {user.role !== "cos" && <LeaveForm onSubmitted={fetchList} />}

      <table className="min-w-full border border-gray-300 mt-4">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">Karyawan</th>
            <th className="border px-2 py-1">Jenis</th>
            <th className="border px-2 py-1">Tanggal</th>
            <th className="border px-2 py-1">Status</th>
            {user.role !== "employee" && <th className="border px-2 py-1">Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={user.role !== "employee" ? 5 : 4} className="text-center py-4 text-gray-500">
                Loading...
              </td>
            </tr>
          ) : list.length > 0 ? (
            list.map((r) => (
              <tr key={r.id}>
                <td className="border px-2 py-1">{r.employee?.name}</td>
                <td className="border px-2 py-1">{r.type}</td>
                <td className="border px-2 py-1">{r.start_date} - {r.end_date}</td>
                <td className="border px-2 py-1">{r.status}</td>
                {user.role !== "employee" && (
                  <td className="border px-2 py-1">
                    {(user.role === "cos" || (user.role === "supervisor" && r.employee?.role === "cos")) &&
                      r.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(r.id, "approve")}
                            className="px-2 py-1 bg-green-500 text-white rounded"
                            disabled={loadingRows[r.id]?.approve}
                          >
                            {loadingRows[r.id]?.approve ? "Mengirim..." : "Approve"}
                          </button>

                          <button
                            onClick={() => handleAction(r.id, "reject")}
                            className="px-2 py-1 bg-red-500 text-white rounded"
                            disabled={loadingRows[r.id]?.reject}
                          >
                            {loadingRows[r.id]?.reject ? "Mengirim..." : "Reject"}
                          </button>
                        </div>
                      )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={user.role !== "employee" ? 5 : 4} className="text-center py-4 text-gray-500">
                Belum ada pengajuan izin/cuti.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

import React, { useState } from "react";
import { useAuth, useShiftSwaps } from "@/context";
import SwapForm from "./SwapForm";

export default function ShiftSwapPage() {
  const { user } = useAuth();
  const { list, loadingData, error: contextError, approveSwap } = useShiftSwaps();
  const [localError, setLocalError] = useState("");
  const [loadingButtons, setLoadingButtons] = useState({}); // { [id]: { approve: bool, reject: bool } }

  const handleAction = async (id, action) => {
    setLocalError("");
    setLoadingButtons(prev => ({ ...prev, [id]: { ...prev[id], [action]: true } }));

    try {
      await approveSwap(id, action);
    } catch (err) {
      setLocalError(err.message || "Terjadi kesalahan");
    } finally {
      setLoadingButtons(prev => ({ ...prev, [id]: { ...prev[id], [action]: false } }));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Tukar Shift</h1>

      {user.role !== "cos" && <SwapForm />}

      {loadingData && <p className="text-gray-500 mb-2">Loading data...</p>}
      {(contextError || localError) && (
        <p className="text-red-500 mb-2">{contextError || localError}</p>
      )}

      <table className="w-full border-collapse border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Pemohon</th>
            <th className="border p-2">Partner</th>
            <th className="border p-2">Tanggal</th>
            <th className="border p-2">Status</th>
            <th className="border p-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {loadingData ? (
            <tr>
              <td colSpan={5} className="text-center p-4 text-gray-500">
                Loading...
              </td>
            </tr>
          ) : list.length > 0 ? (
            list.map(r => {
              const btnLoading = loadingButtons[r.id] || {};
              const canAct = user.role === "cos" || (user.role === "supervisor" && r.requester?.role === "cos");

              return (
                <tr key={r.id}>
                  <td className="border p-2">{r.requester?.name}</td>
                  <td className="border p-2">{r.partner?.name}</td>
                  <td className="border p-2">{r.date}</td>
                  <td className="border p-2">{r.status}</td>
                  <td className="border p-2">
                    {canAct && r.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleAction(r.id, "approve")}
                          className="bg-green-600 text-white px-2 py-1 rounded mr-2"
                          disabled={btnLoading.approve}
                        >
                          {btnLoading.approve ? "Loading..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "reject")}
                          className="bg-red-600 text-white px-2 py-1 rounded"
                          disabled={btnLoading.reject}
                        >
                          {btnLoading.reject ? "Loading..." : "Reject"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5} className="text-center p-4 text-gray-400">
                Tidak ada data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

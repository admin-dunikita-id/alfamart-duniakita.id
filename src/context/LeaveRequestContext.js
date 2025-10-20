// src/context/LeaveRequestContext.js
import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../config/api";

const LeaveRequestContext = createContext();

function extractErrorMessage(err, fallback = "Terjadi kesalahan.") {
  const res = err?.response;
  if (res?.data?.message) return res.data.message;

  const errors = res?.data?.errors;
  if (errors && typeof errors === "object") {
    const firstKey = Object.keys(errors)[0];
    if (firstKey && Array.isArray(errors[firstKey]) && errors[firstKey][0]) {
      return errors[firstKey][0];
    }
  }
  return fallback;
}

export function LeaveRequestProvider({ children }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/leave-requests");
      setList(res.data);
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data izin/cuti.");
    } finally {
      setLoading(false);
    }
  }, []);

  const createRequest = useCallback(
    async (payload) => {
      try {
        await api.post("/leave-requests", payload);
        await fetchList(); // refresh data setelah submit
        return { success: true };
      } catch (err) {
        console.error("Error createRequest:", err?.response?.data || err?.message);
        return {
          success: false,
          message: extractErrorMessage(err, "Gagal mengajukan izin."),
        };
      }
    },
    [fetchList]
  );

  /**
   * Approve/Reject:
   * - Approve: approveRequest(id, 'approve')
   * - Reject : approveRequest(id, 'reject', note)  // note minimal 5 karakter
   */
  const approveRequest = useCallback(
    async (id, action = "approve", note) => {
      try {
        const payload = { action };
        if (action === "reject") {
          const n = (note || "").trim();
          if (n.length < 5) {
            return { success: false, message: "Alasan penolakan minimal 5 karakter." };
          }
          payload.note = n;
        }

        await api.post(`/leave-requests/${id}/approve`, payload);
        await fetchList();
        return { success: true };
      } catch (err) {
        console.error("Error approveRequest:", err?.response?.data || err?.message);
        return {
          success: false,
          message: extractErrorMessage(err, "Gagal update status."),
        };
      }
    },
    [fetchList]
  );

  /**
   * Cancel oleh pemohon:
   * - cancelRequest(id, note)  // note minimal 3 karakter
   */
  const cancelRequest = useCallback(
    async (id, note) => {
      try {
        const n = (note || "").trim();
        if (n.length < 3) {
          return { success: false, message: "Alasan pembatalan minimal 3 karakter." };
        }
        await api.post(`/leave-requests/${id}/cancel`, { note: n });
        await fetchList();
        return { success: true };
      } catch (err) {
        console.error("Error cancelRequest:", err?.response?.data || err?.message);
        return {
          success: false,
          message: extractErrorMessage(err, "Gagal membatalkan pengajuan."),
        };
      }
    },
    [fetchList]
  );

  // Helper agar pemakaian di komponen lebih jelas
  const approve = useCallback((id) => approveRequest(id, "approve"), [approveRequest]);
  const reject  = useCallback((id, note) => approveRequest(id, "reject", note), [approveRequest]);

  return (
    <LeaveRequestContext.Provider
      value={{
        list,
        loading,
        error,
        fetchList,
        createRequest,
        approveRequest, // kompat lama
        approve,        // helper
        reject,         // helper (wajib note)
        cancelRequest,  // pembatalan oleh pemohon (wajib note)
      }}
    >
      {children}
    </LeaveRequestContext.Provider>
  );
}

export function useLeaveRequests() {
  return useContext(LeaveRequestContext);
}

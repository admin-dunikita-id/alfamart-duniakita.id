// src/context/ShiftSwapContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/config/api";
import { useAuth } from "@/context/AuthContext";

const ShiftSwapContext = createContext();
export const useShiftSwaps = () => useContext(ShiftSwapContext);

function getErr(err, fb = "Terjadi kesalahan") {
  const res = err?.response;
  if (res?.data?.message) return res.data.message;
  const errors = res?.data?.errors;
  if (errors && typeof errors === "object") {
    const k = Object.keys(errors)[0];
    if (k && Array.isArray(errors[k]) && errors[k][0]) return errors[k][0];
  }
  return fb;
}

export const ShiftSwapProvider = ({ children }) => {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  const fetchList = useCallback(async () => {
    setLoadingData(true);
    setError("");
    try {
      const res = await api.get("/shift-swaps");
      setList(res.data.data || res.data); // resource collection vs raw
    } catch (err) {
      console.error("Gagal fetch shift-swaps:", err);
      setError("Gagal mengambil data tukar shift");
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Ajukan swap
  const submitSwap = async (payload) => {
    setError("");
    try {
      const res = await api.post("/shift-swaps", payload);
      await fetchList();
      return res.data;
    } catch (err) {
      const e = getErr(err);
      console.error("Gagal submit swap:", err?.response?.data || err?.message);
      throw { message: e };
    }
  };

  // COS approve/reject (bisa kirim note saat reject)
  const approveSwap = async (id, action = "approve", extra = {}) => {
    setError("");
    try {
      const body = { action, ...extra }; // { action, note? }
      const res = await api.post(`/shift-swaps/${id}/approve`, body, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      await fetchList();
      return res.data;
    } catch (err) {
      const e = getErr(err);
      console.error("Gagal approve/reject swap:", err?.response?.data || err?.message);
      throw { message: e };
    }
  };

  // (opsional) partner accept/decline – kalau mau dipakai dari context
  const partnerRespond = async (id, action) => {
    try {
      const res = await api.post(
        `/shift-swaps/${id}/partner?action=${action}`,
        { action },
        { headers: { "Content-Type": "application/json", Accept: "application/json" } }
      );
      await fetchList();
      return res.data;
    } catch (err) {
      const e = getErr(err);
      console.error("Gagal respon partner:", e);
      throw { message: e };
    }
  };

  // ✅ Pemohon batalkan dengan alasan (status -> canceled)
  const requesterCancel = async (id, note) => {
    try {
      const res = await api.post(
        `/shift-swaps/${id}/requester`,
        { action: "cancel", note },
        { headers: { "Content-Type": "application/json", Accept: "application/json" } }
      );
      await fetchList();
      return res.data;
    } catch (err) {
      const e = getErr(err);
      console.error("Gagal cancel (requester):", e);
      throw { message: e };
    }
  };

  useEffect(() => {
    fetchList();
  }, [fetchList, user?.id]);

  return (
    <ShiftSwapContext.Provider
      value={{
        list,
        loadingData,
        error,
        fetchList,
        submitSwap,
        approveSwap,
        partnerRespond,   // optional
        requesterCancel,  // ⬅️ yang diminta
      }}
    >
      {children}
    </ShiftSwapContext.Provider>
  );
};

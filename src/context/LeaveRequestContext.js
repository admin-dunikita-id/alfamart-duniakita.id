// src/context/LeaveRequestContext.js
import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../config/api";

const LeaveRequestContext = createContext();

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

    const createRequest = useCallback(async (payload) => {
        try {
            await api.post("/leave-requests", payload);
            await fetchList(); // refresh data setelah submit
            return { success: true };
        } catch (err) {
            console.error("Error createRequest:", err.response?.data || err.message);
            return {
                success: false,
                message: err.response?.data?.message || "Gagal mengajukan izin.",
            };
        }
    }, [fetchList]);

    const approveRequest = useCallback(async (id, action) => {
        try {
            await api.post(`/leave-requests/${id}/approve`, { action });
            await fetchList();
            return { success: true };
        } catch (err) {
            console.error("Error approveRequest:", err.response?.data || err.message);
            return {
                success: false,
                message: "Gagal update status.",
            };
        }
    }, [fetchList]);

    return (
        <LeaveRequestContext.Provider
            value={{
                list,
                loading,
                error,
                fetchList,
                createRequest,
                approveRequest,
            }}
        >
            {children}
        </LeaveRequestContext.Provider>
    );
}

export function useLeaveRequests() {
    return useContext(LeaveRequestContext);
}

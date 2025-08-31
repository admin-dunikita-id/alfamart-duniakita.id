import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/config/api";
import { useAuth } from "@/context/AuthContext";

const ShiftSwapContext = createContext();
export const useShiftSwaps = () => useContext(ShiftSwapContext);

export const ShiftSwapProvider = ({ children }) => {
    const { user } = useAuth();
    const [list, setList] = useState([]);
    const [loadingData, setLoadingData] = useState(false); // loading untuk table
    const [error, setError] = useState("");

    // fetch semua shift swap
    const fetchList = async () => {
        setLoadingData(true);
        setError("");
        try {
            const res = await api.get("/shift-swaps");
            setList(res.data.data);
        } catch (err) {
            console.error("Gagal fetch shift-swaps:", err);
            setError("Gagal mengambil data tukar shift");
        } finally {
            setLoadingData(false);
        }
    };

    // submit pengajuan swap
    const submitSwap = async (payload) => {
        setError("");
        try {
            const res = await api.post("/shift-swaps", payload);
            await fetchList(); // refresh list
            return res.data;
        } catch (err) {
            console.error("Gagal submit swap:", err.response?.data || err.message);
            throw err.response?.data || err;
        }
    };

    // approve/reject swap (hanya tombol yang loading)
    const approveSwap = async (id, action) => {
        setError("");
        try {
            const res = await api.post(`/shift-swaps/${id}/approve`, { action });
            await fetchList(); // refresh list
            return res.data;
        } catch (err) {
            console.error("Gagal approve/reject swap:", err.response?.data || err.message);
            throw err.response?.data || err;
        }
    };

    useEffect(() => {
        fetchList();
    }, [user?.id]);

    return (
        <ShiftSwapContext.Provider
            value={{
                list,
                loadingData,
                error,
                fetchList,
                submitSwap,
                approveSwap,
            }}
        >
            {children}
        </ShiftSwapContext.Provider>
    );
};

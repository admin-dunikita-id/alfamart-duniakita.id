// src/context/ScheduleContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useQueryClient } from 'react-query';
import api from "@/config/api";

const ScheduleContext = createContext();

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error('useSchedule must be used within a ScheduleProvider');
  return context;
};

// === Base URL (ubah ENV di Vercel juga!) ===
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api-alfamart.duniakita.id/api';

export const ScheduleProvider = ({ children }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  // === API ===
  const scheduleAPI = {
    // --- Ambil jadwal manual (struktur {data:{id:{employee,schedule}}})
    getSchedules: async ({ store_id, month, year }) => {
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/schedules/manual?store_id=${store_id}&year=${year}&month=${month}`;
      console.log('[API] getSchedules URL:', url);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      });
      if (!res.ok) throw new Error('Gagal fetch jadwal manual');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Ambil daftar karyawan
    getEmployees: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/employees`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      });
      if (!res.ok) throw new Error('Gagal fetch karyawan');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Ambil tipe shift
    getShiftTypes: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/shift-types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      });
      if (!res.ok) throw new Error('Gagal fetch shift types');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Reset jadwal individu
    resetSchedule: async (payload) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/schedules/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal reset jadwal');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Simpan jadwal manual
    saveManualSchedule: async (payload) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/schedules/manual-save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal simpan jadwal manual');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Ambil semua toko
    getStores: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/stores`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      });
      if (!res.ok) throw new Error('Gagal fetch stores');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Laporan shift
    getShiftSummary: async (params = {}) => {
      const token = localStorage.getItem('token');
      const qs = new URLSearchParams(
        Object.entries(params).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null && String(v).trim() !== '') acc[k] = v;
          return acc;
        }, {})
      ).toString();
      const url = `${API_BASE_URL}/reports/shift-summary${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Gagal fetch laporan shift');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Generate jadwal otomatis
    generateSchedule: async (scheduleData) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/schedules/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(scheduleData),
      });
      if (!res.ok) throw new Error('Gagal generate schedule');
      const json = await res.json();
      return json.data ?? json;
    },

    // --- Reset semua jadwal (opsional)
    resetAllSchedules: async (payload) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/schedules/reset-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('🛑 Server response:', errorText);
        throw new Error('Gagal reset semua jadwal');
      }
      const json = await res.json();
      return json.data ?? json;
    },
  };

  // === Utility actions ===
  const generateAndSaveSchedule = useCallback(async (generateParams) => {
    const { year, month, employees, shiftTypes, rules } = generateParams;
    const data = {
      year,
      month,
      employees,
      shiftTypes,
      rules,
      generated_at: new Date().toISOString(),
      generated_by: 'system'
    };
    const result = await scheduleAPI.generateSchedule(data);
    setCurrentMonth(new Date(year, month - 1, 1));
    return result;
  }, []);

  const changeMonth = useCallback((newMonth) => {
    setCurrentMonth(newMonth);
    const year = newMonth.getFullYear();
    const month = newMonth.getMonth();
    queryClient.invalidateQueries(['schedules', year, month]);
  }, [queryClient]);

  const refreshCurrentMonth = useCallback(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    queryClient.invalidateQueries(['schedules', year, month]);
  }, [currentMonth, queryClient]);

  // === Context Value ===
  const value = {
    currentMonth,
    isGenerating,
    scheduleAPI,
    generateAndSaveSchedule,
    changeMonth,
    refreshCurrentMonth,
    setCurrentMonth,
    getCurrentMonthKey: () => ({
      year: currentMonth.getFullYear(),
      month: currentMonth.getMonth()
    }),
    formatMonthKey: (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
};

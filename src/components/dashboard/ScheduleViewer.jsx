import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSchedule, useAuth } from '@/context';
import clsx from 'clsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const ScheduleViewer = () => {
  const { scheduleAPI } = useSchedule();
  const { user } = useAuth();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState(null);
  const [createdBy, setCreatedBy] = useState(null);
  const [loading, setLoading] = useState(false);

  const [stores, setStores] = useState([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [searchName, setSearchName] = useState('');

  const [selectedStoreId, setSelectedStoreId] = useState(
    user?.role === 'admin' ? '' : (user?.store_id || '')
  );

  const [compact, setCompact] = useState(false);
  const scrollRef = useRef(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNumbers = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  // Normalisasi teks untuk pencarian
  const norm = (s = '') =>
    s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Ctrl+K fokus ke input
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const el = document.getElementById('viewerSearchInput');
        if (el) { el.focus(); el.select(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fetchSchedule = async () => {
    try {
      if (!selectedStoreId) return;
      setLoading(true);
      const result = await scheduleAPI.getScheduleLists({
        store_id: selectedStoreId,
        year,
        month: month + 1,
      });
      setData(result.data);
      setCreatedBy(result.created_by);
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // unutk scroll di mobile atau tablet
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const onScroll = () => {
    // Hanya hide di tablet/mobile (< lg)
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) return setCompact(false);
    setCompact((el.scrollTop || 0) > 24); // threshold
  };

  el.addEventListener('scroll', onScroll, { passive: true });
  // panggil sekali untuk sync awal
  onScroll();
  return () => el.removeEventListener('scroll', onScroll);
}, []);

  // sampai sini

  // Auto set store id dari user jika kosong
  useEffect(() => {
    if (user?.store_id && !selectedStoreId) {
      setSelectedStoreId(user.store_id);
    }
  }, [user, selectedStoreId]);

  // Refresh jadwal saat filter berubah
  useEffect(() => {
    if (selectedStoreId) fetchSchedule();
  }, [year, month, selectedStoreId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ambil daftar store
  useEffect(() => {
    const fetchStores = async () => {
      setLoadingStore(true);
      try {
        const resp = await scheduleAPI.getStores();
        let storeList = resp.data || [];
        if ((user?.role === 'cos' || user?.role === 'employee') && user?.store_id) {
          storeList = storeList.filter((store) => store.id === user.store_id);
        } else if (user?.role !== 'admin') {
          storeList = storeList.filter((store) => store.id === user?.store_id);
        }
        setStores(storeList);
      } catch (err) {
        console.error(err?.message || err);
      } finally {
        setLoadingStore(false);
      }
    };
    fetchStores();
  }, [user, scheduleAPI]);

  const getShiftColor = (code) => {
    switch (code) {
      case 'P': return 'bg-green-100 text-green-800';
      case 'S': return 'bg-yellow-100 text-yellow-800';
      case 'M': return 'bg-red-100 text-red-800';
      default:  return 'bg-white text-gray-600';
    }
  };

  // Bentukkan rows dari data (object/array → array of {employee, schedule})
  const rows = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') return Object.values(data);
    return [];
  }, [data]);

  // Baris yang terfilter sesuai kolom "Cari Karyawan" (untuk tabel)
const filteredRows = useMemo(() => {
  // Selalu sembunyikan karyawan role 'ac'
  return rows.filter(({ employee = {} }) => {
    const role = String(employee.role || '').toLowerCase();
    return role !== 'ac';
  }).filter(({ employee = {} }) => {
    const q = norm(searchName);
    return q ? norm(employee.name || '').includes(q) : true;
  });
}, [rows, searchName]);

// hasData HARUS dideklarasi SETELAH filteredRows
const hasData = filteredRows.length > 0;

  // Export Excel
  const exportToExcel = async () => {
  if (!hasData) return;

  // Tentukan baris yang akan diekspor:
  // - Jika searchName terisi → ambil 1 karyawan:
  //   * Prioritas: nama yang sama persis (case-insensitive, normalized)
  //   * Jika tidak ada yang persis → ambil match pertama dari filteredRows
  // - Jika searchName kosong → ekspor semua (filteredRows == rows)
  const q = norm(searchName).trim();
  let exportRows = filteredRows;

  if (q) {
    const exact = filteredRows.find(({ employee = {} }) => norm(employee.name || '') === q);
    const single = exact || filteredRows[0];
    if (!single) {
      alert('Tidak ada karyawan yang cocok dengan pencarian.');
      return;
    }
    exportRows = [single]; // hanya 1 karyawan
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Jadwal', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  const monthName = new Date(year, month).toLocaleString('id-ID', { month: 'long' });

  // Judul
  worksheet.mergeCells(1, 1, 1, dayNumbers.length + 1);
  worksheet.getCell('A1').value = `Jadwal Shift Bulan ${monthName} ${year}`;
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.getCell('A1').font = { bold: true, size: 14 };

  // Header
  worksheet.addRow([]);
  const header = worksheet.addRow(['Nama', ...dayNumbers.map((d) => d.toString())]);
  header.getCell(1).font = { bold: true, color: { argb: '000000' } };
  header.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
  dayNumbers.forEach((_, i) => {
    const cell = header.getCell(i + 2);
    cell.font = { bold: true, color: { argb: '000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E5E7EB' } };
  });

  const shiftColors = {
    P: { bg: 'DCFCE7', text: '166534' },
    S: { bg: 'FEF9C3', text: '854D0E' },
    M: { bg: 'FEE2E2', text: '991B1B' },
    '-': { bg: 'FFFFFF', text: '6B7280' },
  };

  exportRows.forEach(({ employee = {}, schedule = {} }) => {
    const rowData = [
      employee.name ?? '-',
      ...dayNumbers.map((day) => schedule?.[day]?.shift?.shift_code || '-'),
    ];
    const row = worksheet.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        const code = cell.value;
        const style = shiftColors[code] || shiftColors['-'];
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bg } };
        cell.font = { color: { argb: style.text }, bold: true };
      }
    });
  });

  worksheet.columns = [{ width: 20 }, ...dayNumbers.map(() => ({ width: 4 }))];

  const base = `jadwal_shift_${String(month + 1).padStart(2, '0')}_${year}`;
  const fileName = q && exportRows.length === 1
    ? `${base}_${(exportRows[0]?.employee?.name || 'karyawan').replace(/\s+/g, '_')}.xlsx`
    : `${base}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
};


return (
  <>
    {/* Kontainer scroll untuk toolbar + tabel */}
    <div ref={scrollRef} className="max-h-[70vh] overflow-auto rounded border">

      {/* Toolbar 2 baris (sticky di dalam kontainer). Auto-hide di mobile/tablet saat scroll */}
      <div
        className={clsx(
          "sticky top-0 z-20 bg-white/90 backdrop-blur px-3 pt-3 pb-3 border-b overflow-hidden transition-all duration-200",
          compact
            ? "max-h-0 opacity-0 -translate-y-1 pointer-events-none lg:max-h-[999px] lg:opacity-100 lg:translate-y-0"
            : "opacity-100 translate-y-0"
        )}
      >
        <div className="grid gap-3 items-end grid-cols-1 lg:grid-cols-12">
          {/* Baris 1: Cari */}
          <div className="min-w-0 lg:col-span-8">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cari Karyawan</label>
            <input
              id="viewerSearchInput"
              type="search"
              placeholder="Ketik nama… "
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full min-w-0 border rounded px-3 py-2"
            />

            {/* MOBILE: tombol di bawah kolom cari (2 kolom 50–50) */}
            <div className="mt-2 grid grid-cols-2 gap-2 lg:hidden">
              <button
                onClick={fetchSchedule}
                className="inline-flex justify-center items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
              >
                🔁 <span>Refresh</span>
              </button>
              <button
                onClick={exportToExcel}
                disabled={!hasData}
                className="inline-flex justify-center items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                title={!hasData ? 'Tidak ada data untuk diekspor' : 'Export ke Excel'}
              >
                📊 <span>Export</span>
              </button>
            </div>
          </div>

          {/* Baris 1: Actions (desktop) */}
          <div className="hidden lg:flex gap-2 justify-end lg:col-span-4">
            <button
              onClick={fetchSchedule}
              className="shrink-0 inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
            >
              🔁 <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={exportToExcel}
              disabled={!hasData}
              className="shrink-0 inline-flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              title={!hasData ? 'Tidak ada data untuk diekspor' : 'Export ke Excel'}
            >
              📊 <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>

          {/* Baris 2: Store */}
          <div className="min-w-0 lg:col-span-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Store</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="w-full min-w-0 border rounded px-2 py-2"
              disabled={loadingStore || user?.role !== 'admin'}
            >
              <option value="">{loadingStore ? 'Memuat Store...' : 'Pilih Store'}</option>
              {!loadingStore && stores.map((store) => (
                <option key={store.id} value={store.id}>{store.store_name}</option>
              ))}
            </select>
          </div>

          {/* Baris 2: Bulan */}
          <div className="min-w-0 lg:col-span-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Bulan</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full min-w-0 border rounded px-2 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          {/* Baris 2: Tahun */}
          <div className="min-w-0 lg:col-span-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tahun</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full min-w-0 border rounded px-2 py-2"
            />
          </div>
        </div>
      </div>

      {/* Tabel Jadwal */}
      {loading ? (
        <p className="text-center text-gray-600 p-3">Memuat data jadwal...</p>
      ) : (
        <div className="shadow-sm">
          {createdBy && (
            <div className="text-sm text-gray-600 italic p-2">
              Jadwal ini dibuat oleh: <span className="font-semibold text-gray-800">{createdBy}</span>
            </div>
          )}

          <table className="min-w-full text-sm text-center border-collapse">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="border px-3 py-2 text-left bg-white sticky left-0 z-20">Nama</th>
                {dayNumbers.map((day) => (
                  <th key={day} className="border px-2 py-2">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ employee = {}, schedule = {} }) => (
                <tr key={employee.id ?? employee.name ?? Math.random()} className="hover:bg-gray-50">
                  <td className="border px-3 py-2 text-left bg-white sticky left-0 z-10">
                    {employee.name ?? '-'}
                  </td>
                  {dayNumbers.map((day) => {
                    const shift = schedule?.[day]?.shift;
                    const shiftCode = shift?.shift_code || '-';
                    const shiftName = shift?.shift_name || 'Tidak ada shift';
                    return (
                      <td
                        key={day}
                        className={clsx('border px-2 py-1 font-semibold rounded', getShiftColor(shiftCode))}
                        title={shiftName}
                      >
                        {shiftCode}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td className="border px-3 py-4 text-center text-gray-500" colSpan={1 + dayNumbers.length}>
                    Tidak ada data untuk ditampilkan.
                    <div className="text-xs text-gray-400 mt-1">
                      Catatan: Karyawan dengan role <code className="px-1 rounded bg-gray-100">ac</code> tidak ditampilkan.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>
);
};

export default ScheduleViewer;

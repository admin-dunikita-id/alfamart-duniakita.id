// ScheduleGenerator.jsx (rapi)
import React, { useState, useEffect } from 'react';
import { useQueryClient } from 'react-query';
import Swal from 'sweetalert2';
import { useForm } from 'react-hook-form';
import { useAuth, useSchedule } from '@/context';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ManualScheduleEditor } from './Molecules';
import { generationOptions, autoSubOptions } from '@/commons';

const ScheduleGenerator = ({ onClose }) => {
  const { scheduleAPI } = useSchedule();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      selectedDate: '',
      dayOfWeek: '',
      dayOfMonth: '',
      startDate: '',
      endDate: '',
      from: '',
      to: ''
    }
  });

  // ======= State =======
  const [loadingStores, setLoadingStores] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(1);

  const [manualSchedules, setManualSchedules] = useState([]);
  const [generationType, setGenerationType] = useState('auto');
  const [autoSubType, setAutoSubType] = useState('monthly');

  const [searchName, setSearchName] = useState('');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState(null);

  const [weeklyPattern] = useState({
    monday: { P: 3, S: 2, M: 1, O: 1 },
    tuesday: { P: 2, S: 3, M: 2, O: 1 },
    wednesday: { P: 3, S: 3, M: 0, O: 1 },
    thursday: { P: 2, S: 2, M: 2, O: 1 },
    friday: { P: 3, S: 2, M: 2, O: 1 },
    saturday: { P: 3, S: 2, M: 1, O: 1 },
    sunday: { P: 0, S: 0, M: 0, O: 4 }
  });

  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(false);

  // derived
  const month = watch('month');
  const year = watch('year');
  const selectedDate = watch('selectedDate');

  // mingguan
  const [weekList, setWeekList] = useState([]);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(null);

  // unutk 1 kali muncul pop up hybrid
  const [hasShownHybridInfo, setHasShownHybridInfo] = useState(false);

  // ======= Utils =======
  function toastWarning(msg) {
    toast(msg, {
      icon: '⚠️',
      style: { background: '#fff7e6', color: '#b45309', border: '1px solid #facc15' }
    });
  }
  const fmt2 = (n) => String(n).padStart(2, '0');
  const weekdayId = (i) =>
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][i];

  function isTodayOrPast(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  d.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return d <= today; // true kalau hari ini atau sebelumnya
}

// min untuk input tanggal harian: max(tgl 1 bulan terpilih, hari ini / H+0)
function getDailyMinISO_H0(year, month) {
  const firstOfMonth = new Date(Number(year), Number(month) - 1, 1);
  const today = new Date();
  firstOfMonth.setHours(0,0,0,0);
  today.setHours(0,0,0,0);

  const minDate = firstOfMonth > today ? firstOfMonth : today; // pilih yg terbesar
  const y = minDate.getFullYear();
  const m = String(minDate.getMonth() + 1).padStart(2, '0');
  const d = String(minDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

  // buat daftar minggu (mulai Senin) dan pangkas ke bulan aktif
  function getWeeksOfMonth(y, m, weekStartDow = 1) {
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const start = new Date(first);
    const diff = (start.getDay() - weekStartDow + 7) % 7;
    start.setDate(start.getDate() - diff);

    const weeks = [];
    for (let w = 0; w < 6; w++) {
      const ws = new Date(start);
      ws.setDate(start.getDate() + w * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);

      const clippedStart = new Date(Math.max(ws, first));
      const clippedEnd = new Date(Math.min(we, last));
      if (clippedStart <= clippedEnd) {
        const label = `${clippedStart.getDate()}–${clippedEnd.getDate()} ${clippedStart.toLocaleDateString('id-ID', { month: 'long' })}`;
        weeks.push({
          label,
          startISO: `${clippedStart.getFullYear()}-${fmt2(clippedStart.getMonth() + 1)}-${fmt2(clippedStart.getDate())}`,
          endISO: `${clippedEnd.getFullYear()}-${fmt2(clippedEnd.getMonth() + 1)}-${fmt2(clippedEnd.getDate())}`
        });
      }
    }
    return weeks;
  }

  // ======= Effects =======
  useEffect(() => {
    (async () => {
      try {
        const res = await scheduleAPI.getStores();
        setStores(res.data || []);
        if (res.data?.length) setSelectedStore(res.data[0].id);
      } catch {
        toast.error('Gagal ambil data toko');
      } finally {
        setLoadingStores(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const d = new Date(selectedDate + 'T00:00:00');
    setValue('dayOfMonth', d.getDate());
    setValue('dayOfWeek', weekdayId(d.getDay()));
  }, [selectedDate, setValue]);

  useEffect(() => {
    const weeks = getWeeksOfMonth(Number(year), Number(month), 1);
    setWeekList(weeks);
    setSelectedWeekIdx(null);
    setValue('from', '');
    setValue('to', '');
  }, [month, year, setValue]);

  // ======= Handlers =======
  const onSubmit = async (formData) => {
    const isAutoLike = ['auto', 'hybrid'].includes(generationType);
    const finalGenerationType =
      isAutoLike && autoSubType === 'weekly'
        ? 'weekly'
        : generationType === 'hybrid'
        ? 'hybrid'
        : generationType;

    setLoading(true);

    // Validasi Custom Range
if (['auto','hybrid'].includes(generationType) && autoSubType === 'custom') {
  const start = new Date(formData.startDate);
  const end   = new Date(formData.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  // ❌ Tanggal selesai harus setelah mulai
  if (start > end) {
    toastWarning('Tanggal selesai harus setelah tanggal mulai.');
    setLoading(false);
    return;
  }

  // ⚠️ Hari ini boleh diklik tapi nggak bisa diproses
  if (start.getTime() === today.getTime()) {
    toastWarning('Kamu cuma bisa pilih tanggal mulai besok ya.');
    setLoading(false);
    return;
  }
}

// Per Hari: Hari ini bisa dipilih tapi tidak bisa diproses
if (isAutoLike && autoSubType === 'daily' && formData.selectedDate) {
  const selected = new Date(formData.selectedDate);
  const today = new Date();

  selected.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // ⚠️ Jika tanggal hari ini → beri warning, batalkan proses
  if (selected.getTime() === today.getTime()) {
    toastWarning('Kamu cuma bisa mulai dari besok ya.');
    setLoading(false);
    return;
  }
}

    // Manual save
    if (generationType === 'manual') {
      if (!manualSchedules.length) {
        toast.error('Jadwal belum diisi');
        setLoading(false);
        return;
      }
      try {
        await scheduleAPI.saveManualSchedule({
          store_id: selectedStore,
          created_by: user.id,
          month: Number(formData.month),
          year: Number(formData.year),
          schedules: manualSchedules
        });
        toast.success('Jadwal manual berhasil disimpan!');
        onClose();
      } catch {
        toast.error('Gagal simpan jadwal manual.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Auto / Hybrid
    const payload = {
      store_id: selectedStore,
      generation_type: finalGenerationType
    };

    if (isAutoLike) {
      if (autoSubType === 'monthly') {
        payload.month = Number(formData.month);
        payload.year = Number(formData.year);
      } else if (autoSubType === 'weekly') {
        payload.month = Number(formData.month);
        payload.year = Number(formData.year);
        if (!formData.from || !formData.to) {
          toastWarning('Silakan pilih minggu terlebih dahulu.');
          setLoading(false);
          return;
        }
        payload.from = formData.from;
        payload.to = formData.to;
        payload.weekly_pattern = weeklyPattern;
      } else if (['daily', 'custom'].includes(autoSubType)) {
        payload.month = Number(formData.month);
        payload.year = Number(formData.year);
        if (autoSubType === 'custom') {
          payload.from = formData.startDate;
          payload.to = formData.endDate;
        }
        if (autoSubType === 'daily') {
          payload.dayOfWeek = formData.dayOfWeek || null;
          payload.dayOfMonth = formData.dayOfMonth ? Number(formData.dayOfMonth) : null;
        }
      }
    } else {
      payload.month = Number(formData.month);
      payload.year = Number(formData.year);
    }

    try {
      await scheduleAPI.generateSchedule(payload);
      toast.success('Jadwal berhasil dibuat!');
      onClose();
    } catch {
      toast.error('Gagal generate jadwal.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAllSchedules = async () => {
    const confirmed = await Swal.fire({
      title: 'Reset Semua Jadwal?',
      text: 'Semua jadwal bulan ini akan dihapus. Lanjutkan?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, reset!'
    });

    if (!confirmed.isConfirmed) return;

    setResetting(true);
    try {
      await scheduleAPI.resetAllSchedules({
        store_id: user.store_id,
        month: Number(month),
        year: Number(year)
      });
      toast.success('Semua jadwal berhasil direset.');
      queryClient.invalidateQueries(['manualSchedules', user.store_id, Number(year), Number(month)]);
    } catch {
      toast.error('Gagal reset semua jadwal.');
    } finally {
      setResetting(false);
    }
  };

  // =======  popup info Mode Hybrid  =======
  useEffect(() => {
    if (generationType === 'hybrid' && !hasShownHybridInfo) {
      {/*Swal.fire({
        title: 'Mode Hybrid Aktif ⚙️',
        icon: 'info',
        html: `
          <div style="text-align:left">
            <p><b>Penjelasan:</b></p>
            <ul style="margin-left:16px">
              <li>Mode <b>Hybrid</b> akan <b>mengisi otomatis</b> hanya pada tanggal yang <b>belum diisi manual</b>.</li>
              <li>Tanggal yang sudah kamu isi manual <b>tidak akan diubah</b>.</li>
              <li>Kamu tetap bisa menentukan rentang: <b>per hari</b>, <b>mingguan</b>, <b>bulanan</b>, atau <b>custom</b>.</li>
           </ul>
            <p style="margin-top:10px"><i>Tips:</i> isi manual dulu tanggal-tanggal penting, lalu jalankan Hybrid untuk melengkapi sisanya.</p>
          </div>
        `,
        confirmButtonText: 'Mengerti',
        showCloseButton: true,
        focusConfirm: false,
        width: 500,
      });*/}
      setHasShownHybridInfo(true);
    }
  }, [generationType]);

  // ======= mobile / dekstop =======

  // di ScheduleGenerator.jsx
const [isMobile, setIsMobile] = React.useState(false);

useEffect(() => {
  const check = () => {
    setIsMobile(window.innerWidth < 768); // <768px kita anggap mobile
  };
  check();
  window.addEventListener('resize', check);
  return () => window.removeEventListener('resize', check);
}, []);


  // ======= UI =======
  return (
    <div className="space-y-6">
      {/* Overlay loading */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center">
          <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      )}

      {/* Jenis generator */}
      <div className="grid grid-cols-3 gap-3">
        {generationOptions.map((opt) => (
          <motion.div
            key={opt.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGenerationType(opt.id)}
            className={`p-3 md:p-4 border-2 rounded-xl cursor-pointer transition-all text-center ${
              generationType === opt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className="text-2xl md:text-3xl mb-2">{opt.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">{opt.title}</h3>
              <p className="text-[11px] md:text-sm text-gray-600 leading-snug">{opt.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pilihan subtype (Auto/Hybrid) */}
      {['auto'].includes(generationType) && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">
            Pilih Tipe {generationType === 'auto' ? 'Otomatis' : 'Hybrid'}:
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {autoSubOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAutoSubType(opt.id)}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  autoSubType === opt.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="font-medium">{opt.title}</div>
                <div className="text-xs opacity-80">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pilih toko + cari karyawan (manual/hybrid) */}
      {(loadingStores || stores.length >= 1) && (
        <div className={`mb-4 ${['manual', 'hybrid'].includes(generationType) ? 'flex items-end gap-2' : ''}`}>
         {/* Pilih Toko */}
          <div className={['manual', 'hybrid'].includes(generationType) ? 'w-1/2' : 'w-full'}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Toko</label>
            {loadingStores ? (
              <div className="text-gray-500 text-sm">Memuat data toko…</div>
            ) : (
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.store_name} ({s.store_code})
                  </option>
                ))}
              </select>
            )}
          </div>

         {/* Cari Karyawan */}
          {['manual', 'hybrid'].includes(generationType) && (
            <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Cari Karyawan</label>
                <div className="flex items-center gap-2">
                <input
                    type="search"
                    placeholder="Cari karyawan"
                    className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                    value={searchName}
                    onChange={(e) => {
                    const v = e.target.value;
                    setSearchName(v);
                    // kalau user mulai ketik, lepas fokus tunggal
                    if (focusedEmployeeId) setFocusedEmployeeId(null);
                    }}
                />
                {searchName && (
                    <button
                    type="button"
                    onClick={() => setSearchName('')}
                    className="px-3 py-2 rounded border"
                    >
                    Bersihkan
                    </button>
                )}
                </div>
            </div>
            )}
        </div>
        )}

        {/* Banner Fokus (manual/hybrid) */}
        {['manual', 'hybrid'].includes(generationType) && focusedEmployeeId && (
        <div className="flex items-center justify-between bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-2 md:px-3 py-1.5 md:py-2 -mt-2 text-xs md:text-sm">
          <div>
            Mode fokus: <span className="font-semibold">1 karyawan</span>
          </div>
          <button
            type="button"
            className="text-blue-700 underline"
            onClick={() => setFocusedEmployeeId(null)}
          >
            Tampilkan semua
          </button>
        </div>
        )}

        {/* Manual editor */}
        {generationType === 'manual' && (
          <>
            <hr className="my-3 border-gray-200" />

            <ManualScheduleEditor
              month={month}
              year={year}
              storeId={selectedStore}
              onChange={setManualSchedules}
              searchName={searchName}                 // ⬅️ filter
              focusedEmployeeId={focusedEmployeeId}   // ⬅️ id yang difokus
              onFocusChange={setFocusedEmployeeId} 
              excludedRoles={['admin', 'ac']}
              compact={isMobile}
              
            />
          </>
        )}

      {/* Hybrid editor + note */}
      {generationType === 'hybrid' && (
        <>

          {/* 🔹 Info Mode Hybrid (responsive style) */}
          <div className="w-full border rounded-lg px-3 py-2 text-xs md:text-sm text-blue-700 bg-blue-50 border-blue-200 mb-3">
            💡 Mode <strong>Hybrid</strong> akan mengisi otomatis hanya pada tanggal yang <strong>belum diisi secara manual</strong>.
          </div>

          <ManualScheduleEditor
            month={month}
            year={year}
            storeId={selectedStore}
            onChange={setManualSchedules}
            searchName={searchName}                 // ⬅️ filter
            focusedEmployeeId={focusedEmployeeId}   // ⬅️ id yang difokus
            onFocusChange={setFocusedEmployeeId} 
            excludedRoles={['admin', 'ac']}
            compact={isMobile}
            
          />
        </>
      )}

      {/* Pilihan subtype (Auto/Hybrid) */}
      {['hybrid'].includes(generationType) && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-3">
            Pilih Tipe {generationType === 'auto' ? 'Otomatis' : 'Hybrid'}:
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {autoSubOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAutoSubType(opt.id)}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  autoSubType === opt.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <div className="font-medium">{opt.title}</div>
                <div className="text-xs opacity-80">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulan & Tahun (sembunyikan saat Custom Range) */}
      {(generationType === 'manual' || autoSubType !== 'custom') && (
        <div className="grid grid-cols-2 gap-4">
           {/* Bulan */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bulan</label>
            <select
                {...register('month', { required: 'Bulan harus dipilih' })}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
            >
                {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('id-ID', { month: 'long' })}
                </option>
                ))}
            </select>
            {errors.month && <p className="text-sm text-red-600">{errors.month.message}</p>}
            </div>

           {/* Tahun */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tahun</label>
            <input
                type="number"
                {...register('year', { required: 'Tahun harus diisi', min: 2024, max: 2030 })}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
            />
            {errors.year && <p className="text-sm text-red-600">{errors.year.message}</p>}
            </div>
        </div>
       )}

      {/* Per Minggu (Auto/Hybrid) */}
      {['auto', 'hybrid'].includes(generationType) && autoSubType === 'weekly' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Minggu</label>
            <select
              value={selectedWeekIdx ?? ''}
              onChange={(e) => {
                const idx = e.target.value === '' ? null : Number(e.target.value);
                setSelectedWeekIdx(idx);
                if (idx !== null) {
                  setValue('from', weekList[idx].startISO);
                  setValue('to', weekList[idx].endISO);
                } else {
                  setValue('from', '');
                  setValue('to', '');
                }
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
            >
              <option value="">-- Pilih Minggu --</option>
              {weekList.map((w, i) => {
                const end = new Date(w.endISO + 'T00:00:00');
                const today = new Date(); 
                today.setHours(0, 0, 0, 0);
                const disabled = end <= today;
                return (
                  <option key={i} value={i} disabled={disabled}>
                    {`Minggu ${i + 1}${disabled ? ' — (lampau)' : ''}`}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Rentang Tanggal</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              readOnly
              value={selectedWeekIdx !== null ? weekList[selectedWeekIdx].label : '—'}
            />
          </div>

          {/* hidden to backend */}
          <input type="hidden" {...register('from')} />
          <input type="hidden" {...register('to')} />
        </div>
      )}

      {/* Per Hari (Auto/Hybrid) */}
      {['auto', 'hybrid'].includes(generationType) && autoSubType === 'daily' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
            <input
                type="date"
                {...register('selectedDate', {
                    required: 'Tanggal harus dipilih',
                })}
                className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
                min={new Date().toISOString().split('T')[0]} 
                max={`${year}-${fmt2(month)}-${fmt2(new Date(year, month, 0).getDate())}`}
            />
            {errors.selectedDate && <p className="text-sm text-red-600">{errors.selectedDate.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hari</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              value={
                selectedDate
                  ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })
                  : '—'
              }
              readOnly
            />
          </div>

          {/* hidden to backend */}
          <input type="hidden" {...register('dayOfWeek')} />
          <input type="hidden" {...register('dayOfMonth')} />
        </div>
      )}

      {/* Custom Range (Auto/Hybrid) */}
      {['auto', 'hybrid'].includes(generationType) && autoSubType === 'custom' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Mulai</label>
            <input 
              type="date" 
              {...register('startDate', { required: 'Wajib diisi' })} 
              className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              min={new Date().toISOString().split('T')[0]} // 🔥 tanggal lampau tidak bisa diklik
            />
            {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal Selesai</label>
            <input 
              type="date" 
              {...register('endDate', { required: 'Wajib diisi' })} 
              className="w-full border rounded-lg px-3 py-2 text-sm md:text-base"
              min={new Date().toISOString().split('T')[0]} // 🔥 tanggal lampau tidak bisa diklik
            />
            {errors.endDate && <p className="text-sm text-red-600">{errors.endDate.message}</p>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-end mt-6">
        {/* Tombol Reset */}
        <button
          type="button"
          onClick={handleResetAllSchedules}
          disabled={resetting}
          className="
            basis-1/2 md:basis-auto
            text-center
            px-3 py-2 md:px-4 md:py-2
            rounded bg-red-600 text-white hover:bg-red-700
            text-sm md:text-base
          "
        >
          {resetting ? 'Resetting...' : 'Reset Semua Jadwal'}
        </button>

        {/* Tombol Generate */}
        <button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={loading}
          className="
            basis-1/2 md:basis-auto
            text-center
            px-3 py-2 md:px-6 md:py-2
            rounded bg-green-600 text-white hover:bg-green-700
            text-sm md:text-base
          "
        >
          {loading ? 'Memproses...' : 'Generate Jadwal'}
        </button>
      </div>
    </div>
  );
};

export default ScheduleGenerator;

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSchedule } from '@/context/ScheduleContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import Swal from 'sweetalert2';

const ManualScheduleEditor = ({
  month,
  year,
  storeId,
  onChange,
  searchName = '',
  focusedEmployeeId = null,
  onFocusChange = () => {},
  compact = false, // 🔥 kunci
}) => {
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState({});
  const { scheduleAPI } = useSchedule();
  const [shiftOptions, setShiftOptions] = useState([]);
  const [showOnlyEmpty, setShowOnlyEmpty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const daysInMonth = new Date(year, month, 0).getDate();

  const norm = (s = '') =>
    s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  useEffect(() => {
    const fetchShiftOptions = async () => {
      try {
        const res = await scheduleAPI.getShiftTypes();
        setShiftOptions(res.data || []);
      } catch (err) {
        toast.error('Gagal mengambil shift');
        console.error(err);
      }
    };
    fetchShiftOptions();
  }, []);

  useEffect(() => {
    const fetchEmployeesAndSchedules = async () => {
      setIsLoading(true);
      try {
        const empRes = await scheduleAPI.getEmployees();

        const employeeList = (empRes.data?.data || []).filter(emp => {
          const r = String(emp?.role || '').toLowerCase();
          return r !== 'admin' && r !== 'ac';
        });
        setEmployees(employeeList);

        const scheduleRes = await scheduleAPI.getSchedules({
          store_id: storeId,
          year,
          month,
        });
        const scheduleList = scheduleRes.data || scheduleRes || [];

        const initial = {};
        employeeList.forEach((emp) => {
          const r = String(emp?.role || '').toLowerCase();
          if (r === 'admin' || r === 'ac') return;
          initial[emp.id] = {};
          for (let d = 1; d <= daysInMonth; d++) {
            initial[emp.id][d] = '';
          }
        });

        scheduleList.forEach(({ employee_id, day, shift_code }) => {
          const d = parseInt(day);
          if (!initial[employee_id]) return;
          initial[employee_id][d] = shift_code;
        });

        setSchedules(initial);
      } catch (err) {
        toast.error('Gagal mengambil data karyawan/jadwal');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (storeId) fetchEmployeesAndSchedules();
  }, [month, year, storeId]);

  // kirim data ke parent
  useEffect(() => {
    if (!onChange) return;
    const payload = [];
    for (const empId in schedules) {
      for (let day = 1; day <= daysInMonth; day++) {
        const shift = schedules[empId][day];
        if (shift) {
          payload.push({
            employee_id: empId,
            day,
            shift_code: shift,
          });
        }
      }
    }
    onChange(payload);
  }, [schedules]);

  const handleChange = (empId, day, value) => {
    setSchedules((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [day]: value,
      },
    }));
  };

  const handleReset = async (empId, empName) => {
    const confirm = await Swal.fire({
      title: `Reset jadwal ${empName}?`,
      text: 'Semua isian jadwal akan dihapus dari database.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, reset',
      cancelButtonText: 'Batal',
    });
    if (!confirm.isConfirmed) return;

    try {
      await scheduleAPI.resetSchedule({
        employee_id: empId,
        store_id: storeId,
        month,
        year,
      });

      setSchedules((prev) => ({
        ...prev,
        [empId]: Object.fromEntries(
          Array.from({ length: daysInMonth }, (_, i) => [i + 1, ''])
        ),
      }));

      Swal.fire('Sukses', 'Jadwal telah dihapus.', 'success');
    } catch (err) {
      Swal.fire('Gagal', 'Tidak dapat menghapus jadwal.', 'error');
      console.error(err);
    }
  };

const filteredEmployees = employees
  .filter((emp) => {
    const r = String(emp?.role || '').trim().toLowerCase();
    return r !== 'admin' && r !== 'ac';
  })
  .filter((emp) => emp.store?.id === Number(storeId))
  .filter((emp) => {
    if (showOnlyEmpty) {
      const empSchedule = schedules[emp.id] || {};
      const isFilled = Object.values(empSchedule).some((v) => v);
      if (isFilled) return false;
    }
    if (searchName && !norm(emp.name).includes(norm(searchName))) return false;
    return true;
  });

  // 👇 helper class tergantung compact
  const cls = {
    title: compact
      ? 'font-semibold text-sm leading-tight'
      : 'font-semibold text-lg leading-normal',
    checkboxRow: compact
      ? 'flex items-center gap-2 text-[11px] leading-tight'
      : 'flex items-center gap-3 text-sm leading-normal',

    tableWrapper: 'overflow-auto border rounded',

    thName: compact
      ? 'border-none bg-gray-100 text-left text-gray-700 font-medium sticky left-0 z-[2] px-2 py-1 text-[11px] leading-tight min-w-[100px]'
      : 'border-none bg-gray-100 text-left text-gray-700 font-medium sticky left-0 z-[2] px-3 py-2 text-sm leading-normal min-w-[140px]',

    thDay: compact
      ? 'border-none bg-gray-100 text-center text-gray-700 font-medium px-1 py-1 text-[11px] leading-tight min-w-[28px]'
      : 'border-none bg-gray-100 text-center text-gray-700 font-medium px-2 py-2 text-sm leading-normal min-w-[40px]',

    tdName: compact
      ? 'border-none text-left text-gray-900 bg-white sticky left-0 z-[1] px-2 py-1 text-[11px] leading-tight'
      : 'border-none text-left text-gray-900 bg-white sticky left-0 z-[1] px-3 py-2 text-sm leading-normal',

    tdCellBase: compact
      ? 'border-none text-center align-middle px-1 py-1'
      : 'border-none text-center align-middle px-2 py-2',

    select: compact
      ? 'border border-gray-300 rounded-md bg-white text-center appearance-none w-12 h-7 text-[11px] leading-none pr-4'
      : 'border border-gray-300 rounded-md bg-white text-center appearance-none w-16 h-9 text-sm leading-normal pr-6',

    empNameBtn: compact
      ? 'hover:underline focus:underline outline-none text-[11px]'
      : 'hover:underline focus:underline outline-none text-sm',

    resetBtn: compact
      ? 'ml-2 text-red-600 underline text-[10px]'
      : 'ml-2 text-red-600 underline text-xs',
  };

  return (
    <div className="space-y-4 relative z-10">
      {/* judul */}
      <h2 className={cls.title}>
        Input Jadwal Manual -{' '}
        {new Date(year, month - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
        {year}
      </h2>

      {/* filter checkbox */}
      <div className={cls.checkboxRow}>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOnlyEmpty}
            onChange={() => setShowOnlyEmpty((prev) => !prev)}
          />
          Hanya tampilkan karyawan yang belum diisi jadwal
        </label>
      </div>

      {/* tabel */}
      <div className={cls.tableWrapper}>
        <table className="min-w-full text-center border-collapse">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className={cls.thName}>Nama Karyawan</th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i + 1} className={cls.thDay}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading || employees.length === 0 || shiftOptions.length === 0 ? (
              [...Array(3)].map((_, rowIdx) => (
                <tr key={rowIdx} className="border-t">
                  <td className={cls.tdName}>
                    <Skeleton
                      width={compact ? 80 : 120}
                      height={compact ? 12 : 16}
                    />
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <td key={i} className={cls.tdCellBase}>
                      <Skeleton height={compact ? 20 : 30} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              filteredEmployees.map((emp) => {
                const isFocused = focusedEmployeeId === emp.id;
                const isDimmed = focusedEmployeeId && !isFocused;

                return (
                  <tr
                    key={emp.id}
                    className={[
                      'border-t transition-all',
                      isFocused ? 'ring-2 ring-emerald-400' : '',
                      isDimmed ? 'opacity-40 pointer-events-none' : '',
                      !isDimmed ? 'hover:bg-gray-50' : ''
                    ].join(' ')}
                  >
                    {/* kolom nama */}
                    <td className={cls.tdName}>
                      <button
                        type="button"
                        className={cls.empNameBtn}
                        title="Klik untuk fokus per orang"
                        onClick={() =>
                          onFocusChange(isFocused ? null : emp.id)
                        }
                      >
                        {emp.name}
                      </button>

                      <button
                        onClick={() => handleReset(emp.id, emp.name)}
                        className={cls.resetBtn}
                      >
                        Reset
                      </button>
                    </td>

                    {/* kolom per tanggal */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      return (
                        <td
                          key={day}
                          className={`${cls.tdCellBase} ${
                            !schedules[emp.id]?.[day] ? 'bg-red-50' : ''
                          }`}
                        >
                          <select
                            value={schedules[emp.id]?.[day] || ''}
                            onChange={(e) =>
                              handleChange(emp.id, day, e.target.value)
                            }
                            className={cls.select}
                          >
                            <option value="">-</option>
                            {shiftOptions
                              .filter(
                                (shift) =>
                                  shift.gender_restriction !== 'male_only' ||
                                  emp.gender === 'male'
                              )
                              .map((shift) => (
                                <option
                                  key={shift.id}
                                  value={shift.shift_code}
                                >
                                  {shift.shift_code}
                                </option>
                              ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManualScheduleEditor;

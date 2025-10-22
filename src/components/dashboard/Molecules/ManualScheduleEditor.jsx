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
  onFocusChange = () => {}
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

  const EXCLUDED_ROLES = new Set(['admin', 'ac']);

  // Helper ambil shift_code dari berbagai bentuk data
  const getShiftCode = (s) =>
    s?.shift_code ?? s?.shift?.code ?? s?.code ?? (typeof s === 'string' ? s : '');

  // Ambil daftar shift
  useEffect(() => {
    const fetchShiftOptions = async () => {
      try {
        const res = await scheduleAPI.getShiftTypes();
        const raw = res?.data ?? res ?? [];
        setShiftOptions(Array.isArray(raw) ? raw : Object.values(raw || {}));
      } catch (err) {
        toast.error('Gagal mengambil shift');
        console.error(err);
      }
    };
    fetchShiftOptions();
  }, []);

  // Ambil data karyawan + jadwal
  useEffect(() => {
    const fetchEmployeesAndSchedules = async () => {
      setIsLoading(true);
      try {
        // === Employees ===
        const empRes = await scheduleAPI.getEmployees();
        const empRaw = empRes?.data?.data ?? empRes?.data ?? empRes ?? [];
        const empArr = Array.isArray(empRaw) ? empRaw : Object.values(empRaw || {});
        const employeeList = empArr.filter((emp) => {
          const r = String(emp?.role || '').toLowerCase();
          return !EXCLUDED_ROLES.has(r);
        });
        setEmployees(employeeList);

        // === Schedules ===
        const scheduleRes = await scheduleAPI.getSchedules({ store_id: storeId, year, month });
        const scheduleMap = scheduleRes?.data ?? scheduleRes ?? {};

        // === Siapkan grid kosong ===
        const initial = {};
        employeeList.forEach((emp) => {
          initial[emp.id] = {};
          for (let d = 1; d <= daysInMonth; d++) initial[emp.id][d] = '';
        });

        console.log('scheduleRes.data:', scheduleRes?.data);

        // === Isi grid dari scheduleMap ===
        Object.values(scheduleMap || {}).forEach(({ employee, schedule }) => {
          const empId = employee?.id;
          if (!empId || !initial[empId]) return;

          if (Array.isArray(schedule)) {
            // Bentuk array [{day:1, shift_code:'P'}, ...]
            schedule.forEach((s) => {
              const dayNum = parseInt(s?.day, 10);
              const code = getShiftCode(s);
              if (Number.isFinite(dayNum)) initial[empId][dayNum] = code;
            });
          } else if (schedule && typeof schedule === 'object') {
            // Bentuk object {"1":{shift_code:'P'}, ...}
            Object.entries(schedule).forEach(([d, s]) => {
              const dayNum = parseInt(d, 10);
              const code = getShiftCode(s);
              if (Number.isFinite(dayNum)) initial[empId][dayNum] = code;
            });
          }
        });

        console.log("✅ EMPLOYEES:", employeeList);
console.log("✅ INITIAL SCHEDULE:", initial);

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

  // === Notifikasi perubahan ke parent ===
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
            shift_code: shift
          });
        }
      }
    }
    onChange(payload);
  }, [schedules]);

  // === Handler perubahan shift ===
  const handleChange = (empId, day, value) => {
    setSchedules((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [day]: value
      }
    }));
  };

  // === Handler reset jadwal ===
  const handleReset = async (empId, empName) => {
    const confirm = await Swal.fire({
      title: `Reset jadwal ${empName}?`,
      text: 'Semua isian jadwal akan dihapus dari database.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, reset',
      cancelButtonText: 'Batal'
    });
    if (!confirm.isConfirmed) return;

    try {
      await scheduleAPI.resetSchedule({
        employee_id: empId,
        store_id: storeId,
        month,
        year
      });

      setSchedules((prev) => ({
        ...prev,
        [empId]: Object.fromEntries(
          Array.from({ length: daysInMonth }, (_, i) => [i + 1, ''])
        )
      }));

      Swal.fire('Sukses', 'Jadwal telah dihapus.', 'success');
    } catch (err) {
      Swal.fire('Gagal', 'Tidak dapat menghapus jadwal.', 'error');
      console.error(err);
    }
  };

  // === Filter tampilan karyawan ===
  const filteredEmployees = employees
    .filter((emp) => !EXCLUDED_ROLES.has(String(emp?.role || '').toLowerCase()))
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

  // === Render ===
  return (
    <div className="space-y-4 relative z-10">
      <h2 className="font-semibold text-lg">
        Input Jadwal Manual -{' '}
        {new Date(year, month - 1).toLocaleString('id-ID', { month: 'long' })}{' '}
        {year}
      </h2>

      <div className="flex items-center gap-3">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={showOnlyEmpty}
            onChange={() => setShowOnlyEmpty((prev) => !prev)}
          />
          Hanya tampilkan karyawan yang belum diisi jadwal
        </label>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm text-center">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-left">Nama Karyawan</th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i + 1} className="p-2">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading || employees.length === 0 || shiftOptions.length === 0 ? (
              [...Array(3)].map((_, rowIdx) => (
                <tr key={rowIdx} className="border-t">
                  <td className="p-2">
                    <Skeleton width={120} />
                  </td>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <td key={i} className="p-1">
                      <Skeleton height={30} />
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
                    <td className="p-2 text-left font-medium">
                      <button
                        type="button"
                        className="hover:underline focus:underline outline-none"
                        title="Klik untuk fokus per orang"
                        onClick={() =>
                          onFocusChange(isFocused ? null : emp.id)
                        }
                      >
                        {emp.name}
                      </button>
                      <button
                        onClick={() => handleReset(emp.id, emp.name)}
                        className="ml-2 text-xs text-red-600 underline"
                      >
                        Reset
                      </button>
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const day = i + 1;
                      return (
                        <td
                          key={day}
                          className={`p-1 ${
                            !schedules[emp.id]?.[day] ? 'bg-red-50' : ''
                          }`}
                        >
                          <select
                            value={schedules[emp.id]?.[day] || ''}
                            onChange={(e) =>
                              handleChange(emp.id, day, e.target.value)
                            }
                            className="w-16 text-sm text-center border border-gray-300 rounded-md bg-white appearance-none pr-6"
                          >
                            <option value="">-</option>
                            {shiftOptions
                              .filter(
                                (shift) =>
                                  shift.gender_restriction !== 'male_only' ||
                                  emp.gender === 'male'
                              )
                              .map((shift) => (
                                <option key={shift.id} value={shift.shift_code}>
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

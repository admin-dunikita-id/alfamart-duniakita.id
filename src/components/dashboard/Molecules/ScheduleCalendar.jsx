import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import idLocale from 'date-fns/locale/id';

const locales = { id: idLocale };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const shiftNames = { P: 'Pagi', S: 'Siang', M: 'Malam', O: 'Off' };

const ScheduleCalendar = ({ data }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // <— track view aktif
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef(null);

  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  // Utility: hitung jam start/end per kode shift
  const getShiftTime = (code) => {
    let startHour = 8, endHour = 16;
    if (code === 'S') { startHour = 12; endHour = 20; }
    else if (code === 'M') { startHour = 20; endHour = 8; }
    return { startHour, endHour };
  };

  // Build events berbeda tergantung view
  const events = useMemo(() => {
    const eventsAcc = [];

    if (view === 'month') {
      // ——— MODE MONTH: gabungkan per shift (judul: "Pagi: A, B, C")
      Object.values(data).forEach(({ employee, schedule }) => {
        if (!employee || !schedule) return;

        Object.entries(schedule).forEach(([day, schedItem]) => {
          const shift = schedItem?.shift;
          if (!shift) return;

          const date = new Date(selectedYear, selectedMonth - 1, parseInt(day));
          const { startHour, endHour } = getShiftTime(shift.shift_code);

          const start = new Date(date);
          start.setHours(startHour, 0);

          const end = new Date(date);
          if (shift.shift_code === 'M') end.setDate(end.getDate() + 1);
          end.setHours(endHour, 0);

          // Kumpulkan semua nama dengan shift yang sama di hari tsb
          const employeeNames = Object.values(data)
            .filter(({ schedule }) => schedule?.[day]?.shift?.shift_code === shift.shift_code)
            .map(({ employee }) => employee.name)
            .join(', ');

          // Untuk menghindari duplikasi push banyak kali, kita hanya push sekali per shift/hari.
          // Trik: hanya push jika employee.id terkecil (atau nama alfabetis pertama).
          // Cara simpel: hanya push saat nama ini adalah yang "pertama" (paling kecil secara string).
          const allNames = Object.values(data)
            .filter(({ schedule }) => schedule?.[day]?.shift?.shift_code === shift.shift_code)
            .map(({ employee }) => employee.name)
            .sort();

          if (employee.name === allNames[0]) {
            eventsAcc.push({
              title: `${shiftNames[shift.shift_code]}: ${employeeNames || '-'}`,
              start,
              end,
              resource: { type: 'aggregate', code: shift.shift_code, day },
            });
          }
        });
      });
    } else {
      // ——— MODE WEEK/DAY: event per karyawan (judul: "Nama (Pagi)")
      Object.values(data).forEach(({ employee, schedule }) => {
        if (!employee || !schedule) return;

        Object.entries(schedule).forEach(([day, schedItem]) => {
          const shift = schedItem?.shift;
          if (!shift) return;

          const date = new Date(selectedYear, selectedMonth - 1, parseInt(day));
          const { startHour, endHour } = getShiftTime(shift.shift_code);

          const start = new Date(date);
          start.setHours(startHour, 0);

          const end = new Date(date);
          if (shift.shift_code === 'M') end.setDate(end.getDate() + 1);
          end.setHours(endHour, 0);

          eventsAcc.push({
            title: `${employee.name} (${shiftNames[shift.shift_code]})`,
            start,
            end,
            resource: {
              type: 'per-employee',
              name: employee.name,
              code: shift.shift_code,
              day,
            },
          });
        });
      });
    }

    return eventsAcc;
  }, [data, selectedMonth, selectedYear, view]);

  // Detail shift untuk modal
  const getShiftDetailForDate = (date) => {
    const shiftGroups = { Pagi: [], Siang: [], Malam: [], Off: [] };
    const day = date.getDate();

    Object.values(data).forEach(({ employee, schedule }) => {
      const code = schedule?.[day]?.shift?.shift_code;
      const name = employee?.name;
      if (!code || !name) return;

      if (code === 'P') shiftGroups.Pagi.push(name);
      else if (code === 'S') shiftGroups.Siang.push(name);
      else if (code === 'M') shiftGroups.Malam.push(name);
      else if (code === 'O') shiftGroups.Off.push(name);
    });

    return shiftGroups;
  };

  // Tutup modal saat klik luar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowModal(false);
      }
    };
    if (showModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal]);

  // Custom renderer untuk event (bisa beda konten di week/day vs month)
  const EventCell = ({ event }) => {
    if (view === 'month') {
      // ringkas di month
      return (
        <div className="text-[11px] leading-tight">
          {event.title}
        </div>
      );
    }
    // lebih detail di week/day
    return (
      <div className="text-xs">
        <div className="font-semibold">{event.resource?.name || event.title}</div>
        {event.resource?.code && (
          <div className="opacity-75">{shiftNames[event.resource.code]}</div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 bg-white rounded shadow relative z-0">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        date={currentDate}
        view={view}
        onView={(v) => setView(v)}                  // <— DI SINI: tangkap klik Week/Day/Month
        defaultView="month"
        views={['month', 'week', 'day']}
        onNavigate={(date) => setCurrentDate(date)}
        selectable
        onSelectSlot={({ start }) => {
          setSelectedDate(start);
          setShowModal(true);
        }}
        onSelectEvent={(event) => setShowModal(true)}
        style={{ height: 600 }}
        popup
        onShowMore={(evts, date) => {
          setSelectedDate(date);
          setShowModal(true);
        }}
        // Kalau ingin fetch data sesuai range view aktif, pakai ini:
        // onRangeChange={(range) => {
        //   // range bisa tanggal start-end (week/day) atau array tanggal (month)
        //   // Lakukan fetch di sini kalau perlu
        // }}
        components={{
          event: EventCell, // <— DI SINI: atur tampilan isi event per view
        }}
      />

      {/* Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg transition-all duration-300 ease-in-out">
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md px-4 py-3 relative animate-fade-in transform transition-all duration-500 ease-in-out"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-center">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}
            </h2>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 via-teal-100 to-teal-300 rounded-lg shadow-md">
                <span className="text-lg sm:text-xl font-semibold text-teal-800">Pagi</span>
                <span className="text-sm sm:text-lg text-teal-700">
                  {getShiftDetailForDate(selectedDate).Pagi.join(', ') || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 via-orange-100 to-orange-300 rounded-lg shadow-md">
                <span className="text-lg sm:text-xl font-semibold text-orange-800">Siang</span>
                <span className="text-sm sm:text-lg text-orange-700">
                  {getShiftDetailForDate(selectedDate).Siang.join(', ') || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 via-indigo-100 to-indigo-300 rounded-lg shadow-md">
                <span className="text-lg sm:text-xl font-semibold text-indigo-800">Malam</span>
                <span className="text-sm sm:text-lg text-indigo-700">
                  {getShiftDetailForDate(selectedDate).Malam.join(', ') || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 via-gray-100 to-gray-300 rounded-lg shadow-md">
                <span className="text-lg sm:text-xl font-semibold text-gray-800">Off</span>
                <span className="text-sm sm:text-lg text-gray-700">
                  {getShiftDetailForDate(selectedDate).Off.join(', ') || '-'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-600 text-2xl sm:text-3xl transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;

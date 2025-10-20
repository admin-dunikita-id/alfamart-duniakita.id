import React, { useState, useRef, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import idLocale from 'date-fns/locale/id';

const locales = {
  id: idLocale,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
});

const ScheduleCalendar = ({ data }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef(null); // Reference for the modal

  const selectedMonth = currentDate.getMonth() + 1;
  const selectedYear = currentDate.getFullYear();

  // Convert the schedule data into events
  const convertScheduleToEvents = () => {
    const events = [];

    Object.values(data).forEach(({ employee, schedule }) => {
      if (!employee || !schedule) return;

      Object.entries(schedule).forEach(([day, schedItem]) => {
        const shift = schedItem?.shift;
        if (!shift) return;

        const date = new Date(selectedYear, selectedMonth - 1, parseInt(day));

        let startHour = 8, endHour = 16;
        if (shift.shift_code === 'S') {
          startHour = 12;
          endHour = 20;
        } else if (shift.shift_code === 'M') {
          startHour = 20;
          endHour = 8;
        }

        const start = new Date(date);
        start.setHours(startHour, 0);

        const end = new Date(date);
        if (shift.shift_code === 'M') {
          end.setDate(end.getDate() + 1);
        }
        end.setHours(endHour, 0);

        // Collect employee names by shift and order by 'Pagi', 'Siang', 'Malam', 'Off'
        const shiftNames = {
          'P': 'Pagi',
          'S': 'Siang',
          'M': 'Malam',
          'O': 'Off',
        };

        const employeeNames = Object.values(data)
          .filter(({ schedule }) => schedule?.[day]?.shift?.shift_code === shift.shift_code)
          .map(({ employee }) => employee.name)
          .join(', ');

        events.push({
          title: `${shiftNames[shift.shift_code]}: ${employeeNames}`,
          start,
          end,
          resource: {
            name: employee.name,
            code: shift.shift_code,
          },
        });
      });
    });

    

    return events;
  };

  // Function to get shift details for a specific date
  const getShiftDetailForDate = (date) => {
    const shiftGroups = {
      Pagi: [],
      Siang: [],
      Malam: [],
      Off: [],
    };

    const day = date.getDate();

    Object.values(data).forEach(({ employee, schedule }) => {
      const shift = schedule?.[day]?.shift;
      const code = shift?.shift_code;
      const name = employee?.name;
      if (!code || !name) return;

      switch (code) {
        case 'P':
          shiftGroups.Pagi.push(name);
          break;
        case 'S':
          shiftGroups.Siang.push(name);
          break;
        case 'M':
          shiftGroups.Malam.push(name);
          break;
        case 'O':
          shiftGroups.Off.push(name);
          break;
        default:
          break;
      }
    });

    return shiftGroups;
  };

  

  // Close modal when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setShowModal(false);
      }
    };

    if (showModal) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModal]);

  return (
    <div className="p-4 bg-white rounded shadow relative z-0">
      <Calendar
        localizer={localizer}
        events={convertScheduleToEvents()} // Displaying events (shifts) on the calendar
        startAccessor="start"
        endAccessor="end"
        defaultView="month"
        views={['month', 'week', 'day']}
        date={currentDate}
        onNavigate={(date) => setCurrentDate(date)}
        selectable={true}
        onSelectSlot={({ start }) => {
          setSelectedDate(start);
          setShowModal(true);
        }}
        onSelectEvent={(event) => setShowModal([event])}
        style={{ height: 600 }}
        popup={true}
        onShowMore={(events, date) => {
          console.log('Show more clicked:', { events, date });
          setShowModal(true);
        }}
      />

      {/* Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-lg transition-all duration-300 ease-in-out">
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md px-4 py-3 relative animate-fade-in transform transition-all duration-500 ease-in-out"
          >
            {/* Modal Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-center">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: idLocale })}
            </h2>

            {/* Shift Categories */}
            <div className="space-y-3 sm:space-y-4">
              {/* Pagi Shift */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-teal-50 via-teal-100 to-teal-300 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-200">
                <span className="text-lg sm:text-xl font-semibold text-teal-800">Pagi</span>
                <span className="text-sm sm:text-lg text-teal-700">{getShiftDetailForDate(selectedDate).Pagi.join(', ') || '-'}</span>
              </div>

              {/* Siang Shift */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-orange-50 via-orange-100 to-orange-300 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-200">
                <span className="text-lg sm:text-xl font-semibold text-orange-800">Siang</span>
                <span className="text-sm sm:text-lg text-orange-700">{getShiftDetailForDate(selectedDate).Siang.join(', ') || '-'}</span>
              </div>

              {/* Malam Shift */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 via-indigo-100 to-indigo-300 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200">
                <span className="text-lg sm:text-xl font-semibold text-indigo-800">Malam</span>
                <span className="text-sm sm:text-lg text-indigo-700">{getShiftDetailForDate(selectedDate).Malam.join(', ') || '-'}</span>
              </div>

              {/* Off Shift */}
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-gray-50 via-gray-100 to-gray-300 rounded-lg shadow-md transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:ring-2 hover:ring-gray-500 focus:outline-none focus:ring-4 focus:ring-gray-200">
                <span className="text-lg sm:text-xl font-semibold text-gray-800">Off</span>
                <span className="text-sm sm:text-lg text-gray-700">{getShiftDetailForDate(selectedDate).Off.join(', ') || '-'}</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-2 right-2 text-gray-600 hover:text-red-600 text-2xl sm:text-3xl transform transition-all duration-300 hover:scale-125 focus:outline-none focus:ring-4 focus:ring-red-200"
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

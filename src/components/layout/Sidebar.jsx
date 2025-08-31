import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const linkClass =
    "block p-2 rounded transition-colors duration-200 hover:bg-gray-700";
  const activeClass = "bg-gray-900 font-semibold";

  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen p-4">
      <ul className="space-y-2">
        <li>
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              isActive ? `${linkClass} ${activeClass}` : linkClass
            }
          >
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/leave"
            className={({ isActive }) =>
              isActive ? `${linkClass} ${activeClass}` : linkClass
            }
          >
            Izin / Cuti / Sakit
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/shift-swap"
            className={({ isActive }) =>
              isActive ? `${linkClass} ${activeClass}` : linkClass
            }
          >
            Tukar Shift
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/calendar"
            className={({ isActive }) =>
              isActive ? `${linkClass} ${activeClass}` : linkClass
            }
          >
            Kalender
          </NavLink>
        </li>
      </ul>
    </aside>
  );
}

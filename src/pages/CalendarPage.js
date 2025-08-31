// src/pages/CalendarPage.jsx
import React, { useEffect, useState, Fragment } from "react";
import { ArrowLeftIcon, RefreshCw } from "lucide-react";
import { Listbox } from "@headlessui/react";
import { useSchedule } from "@/context/ScheduleContext";
import { ScheduleCalendar } from "@/components/dashboard";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Skeleton,
    Button,
    Input
} from "@/components/dashboard/Molecules/ui";

const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString("id-ID", { month: "long" })
);

const CalendarPage = () => {
    const appUrl = process.env.REACT_APP_URL || "http://localhost:3000";
    const today = new Date();
    const { scheduleAPI } = useSchedule();
    const [search, setSearch] = useState("");
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const result = await scheduleAPI.getSchedulesByMonth(year, month);
            setData(result.data);
        } catch (err) {
            console.error("Failed to fetch schedule:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, [year, month]);

    return (
        <div className="p-6 space-y-6">
            {/* Back Button */}
            <a
                href={`${appUrl}/dashboard`}
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
                <ArrowLeftIcon className="w-5 h-5" />
                Kembali ke Dashboard
            </a>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-gray-800">
                        📅 Kalender Jadwal Shift
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filter Controls */}
                    <div className="flex flex-wrap items-end gap-4 mb-6">
                        <div>
                            <label className="text-sm font-medium text-gray-600">Bulan</label>
                            <Listbox value={month} onChange={setMonth}>
                                <div className="relative mt-1 w-[180px]">
                                    <Listbox.Button className="relative w-full cursor-pointer rounded border border-gray-300 bg-white py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                        {months[month]}
                                    </Listbox.Button>

                                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                        {/* Tambahkan input search */}
                                        <div className="sticky top-0 bg-white px-2 py-1 border-b border-gray-200">
                                            <input
                                                type="text"
                                                placeholder="Cari bulan..."
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                className="w-full border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            />
                                        </div>

                                        {/* Filter hasil */}
                                        {months
                                            .filter((m) =>
                                                m.toLowerCase().includes(search.toLowerCase())
                                            )
                                            .map((m, idx) => (
                                                <Listbox.Option
                                                    key={idx}
                                                    value={idx}
                                                    className={({ active, selected }) =>
                                                        `cursor-pointer select-none px-3 py-2 ${active ? "bg-indigo-100 text-indigo-900" : "text-gray-900"
                                                        } ${selected ? "font-semibold" : ""}`
                                                    }
                                                >
                                                    {m}
                                                </Listbox.Option>
                                            ))}
                                    </Listbox.Options>
                                </div>
                            </Listbox>

                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-600">Tahun</label>
                            <Input
                                type="number"
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-[120px]"
                            />
                        </div>

                        <Button
                            onClick={fetchSchedule}
                            variant="default"
                            className="ml-auto flex items-center gap-2"
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Calendar Display */}
                    {loading ? (
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: 28 }).map((_, i) => (
                                <Skeleton key={i} className="h-20 rounded-md" />
                            ))}
                        </div>
                    ) : data ? (
                        <ScheduleCalendar data={data} />
                    ) : (
                        <p className="text-gray-500 text-center">
                            Tidak ada data jadwal untuk bulan ini.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CalendarPage;

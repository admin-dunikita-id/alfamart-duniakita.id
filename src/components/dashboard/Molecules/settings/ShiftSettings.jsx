import { useEffect, useState } from 'react';
import { PencilSquareIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/solid';
import Skeleton from 'react-loading-skeleton';
import Swal from 'sweetalert2';
import 'react-loading-skeleton/dist/skeleton.css';
import { useSettings } from '@/context/SettingsContext';

const ShiftSettings = () => {
    const { fetchShifts, addShift, deleteShift } = useSettings();
    const [shifts, setShifts] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        shift_code: '',
        shift_name: '',
        start_time: '',
        end_time: '',
        gender_restriction: 'none'
    });
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchShifts().then(data => {
            setShifts(data);
            setLoading(false);
        });
    }, []);

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await addShift(form);
            Swal.fire('Berhasil', 'Shift berhasil disimpan.', 'success');
            resetForm();
            const data = await fetchShifts();
            setShifts(data);
        } catch (err) {
            console.error('❌ Gagal simpan shift:', err);
            Swal.fire('Gagal', 'Terjadi kesalahan.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (shift) => {
        setSelected(shift);
        setForm({
            shift_code: shift.shift_code || '',
            shift_name: shift.shift_name || '',
            start_time: shift.start_time?.slice(0, 5) || '',
            end_time: shift.end_time?.slice(0, 5) || '',
            gender_restriction: shift.gender_restriction || 'none',
        });
        setIsModalOpen(true); // Open modal for editing
    };

    const handleDelete = async () => {
        try {
            await deleteShift(selected.id);
            Swal.fire('Terhapus', 'Shift berhasil dihapus.', 'success');
            const data = await fetchShifts();
            setShifts(data);
            setIsDeleteModalOpen(false); // Close delete modal after successful deletion
        } catch (err) {
            console.error('❌ Gagal hapus shift:', err);
            Swal.fire('Gagal', 'Terjadi kesalahan saat menghapus.', 'error');
        }
    };

    const resetForm = () => {
        setForm({
            shift_code: '',
            shift_name: '',
            start_time: '',
            end_time: '',
            gender_restriction: 'none',
        });
        setSelected(null);
    };

    return (
        <div className="p-4">
            <h2 className="text-2xl font-bold mb-4">Pengaturan Shift</h2>

            {/* Wrapper Flex untuk Tombol */}
            <div className="flex justify-end mb-4">
                {/* Tombol Tambah Shift Baru */}
                <button
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200"
                    onClick={() => setIsModalOpen(true)} // Open modal for adding new shift
                >
                    <DocumentIcon className="w-5 h-5" /> {/* Ikon Document Add */}
                    Tambah Shift Baru
                </button>
            </div>

            <div className="overflow-x-auto rounded shadow mb-6">
                <table className="min-w-[700px] w-full text-sm text-left border border-gray-200">
                    <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 border">Code</th>
                            <th className="px-4 py-3 border">Nama Shift</th>
                            <th className="px-4 py-3 border">Mulai</th>
                            <th className="px-4 py-3 border">Selesai</th>
                            <th className="px-4 py-3 border">Gender</th>
                            <th className="px-4 py-3 border">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-gray-800">
                        {loading ? (
                            [...Array(3)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(6)].map((_, j) => (
                                        <td key={j} className="px-4 py-2 border"><Skeleton /></td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            shifts.map((shift) => (
                                <tr key={shift.id} className="hover:bg-gray-100 transition">
                                    <td className="px-4 py-2 border">{shift.shift_code}</td>
                                    <td className="px-4 py-2 border">{shift.shift_name}</td>
                                    <td className="px-4 py-2 border">{shift.start_time}</td>
                                    <td className="px-4 py-2 border">{shift.end_time}</td>
                                    <td className="px-4 py-2 border">{shift.gender_restriction}</td>
                                    <td className="px-4 py-2 border text-center">
                                        <div className="flex gap-2 justify-center">
                                            <button
                                                className="flex items-center gap-1 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                                                onClick={() => handleEdit(shift)}
                                            >
                                                <PencilSquareIcon className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                className="flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                                                onClick={() => {
                                                    setSelected(shift);
                                                    setIsDeleteModalOpen(true); // Open delete confirmation modal
                                                }}
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal untuk Form Tambah dan Edit */}
            <div className={`fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex justify-center items-center ${isModalOpen ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-2">{selected ? 'Edit Shift' : 'Tambah Shift Baru'}</h3>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-1">Kode Shift</label>
                            <input
                                type="text"
                                name="shift_code"
                                value={form.shift_code}
                                onChange={handleChange}
                                className="input w-full mb-2 border-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block mb-1">Nama Shift</label>
                            <input
                                type="text"
                                name="shift_name"
                                value={form.shift_name}
                                onChange={handleChange}
                                className="input w-full mb-2 border-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block mb-1">Jam Mulai</label>
                            <input
                                type="time"
                                name="start_time"
                                value={form.start_time}
                                onChange={handleChange}
                                className="input w-full mb-2 border-gray-300"
                            />
                        </div>

                        <div>
                            <label className="block mb-1">Jam Selesai</label>
                            <input
                                type="time"
                                name="end_time"
                                value={form.end_time}
                                onChange={handleChange}
                                className="input w-full mb-2 border-gray-300"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block mb-1">Gender Restriction</label>
                            <select
                                name="gender_restriction"
                                value={form.gender_restriction}
                                onChange={handleChange}
                                className="input w-full mb-3 border-gray-300"
                            >
                                <option value="none">Tanpa Restriksi</option>
                                <option value="male_only">Laki-laki Saja</option>
                                <option value="female_only">Perempuan Saja</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            className={`btn bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? 'Menyimpan...' : 'Simpan Shift'}
                        </button>

                        <button
                            className="btn bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                            onClick={() => setIsModalOpen(false)} // Close modal
                        >
                            Batal
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Konfirmasi Hapus */}
            <div className={`fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex justify-center items-center ${isDeleteModalOpen ? 'block' : 'hidden'}`}>
                <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-4">Yakin ingin menghapus shift ini?</h3>
                    <div className="flex items-center gap-2">
                        <button
                            className="btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                            onClick={handleDelete}
                        >
                            Ya, Hapus
                        </button>

                        <button
                            className="btn bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                            onClick={() => setIsDeleteModalOpen(false)} // Close delete modal
                        >
                            Batal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShiftSettings;

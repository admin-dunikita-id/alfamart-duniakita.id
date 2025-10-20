import React, { useEffect, useState } from 'react';
import Input from './ui/Input';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import 'react-loading-skeleton/dist/skeleton.css';
import { PencilIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useAuth, useEmployees } from '@/context';

const EmployeeManagement = () => {
  const {
    employees,
    stores,
    pagination,
    loading,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    fetchEmployees
  } = useEmployees();

  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    store_id: '',
    name: '',
    nik: '',
    gender: '',
    email: '',
    phone: '',
    status: ''
  });

  // Field error state (inline error di bawah input)
  const [fieldErrors, setFieldErrors] = useState({
    nik: '',
    email: '',
    phone: ''
  });

  const { user } = useAuth();

  // === Helpers Validasi NIK ===
  const NIK_LEN = 8;
  const nikLength = form.nik?.length || 0;
  const nikIsAllDigits = /^[0-9]*$/.test(form.nik || '');
  const nikIsValid = nikIsAllDigits && nikLength === NIK_LEN;

  // Pesan error NIK (inline)
  const nikErrorCalc =
    !nikIsAllDigits
      ? 'NIK hanya boleh berisi angka.'
      : nikLength === 0
      ? ''
      : nikLength < NIK_LEN
      ? `Minimal ${NIK_LEN} digit. (${nikLength}/${NIK_LEN})`
      : nikLength > NIK_LEN
      ? `Maksimal ${NIK_LEN} digit. (${nikLength}/${NIK_LEN})`
      : '';

  // Gabungkan dengan error dari server (prioritas server)
  const nikError = fieldErrors.nik || nikErrorCalc;

  const handleNikChange = (e) => {
    let val = (e.target.value || '').replace(/\D/g, '');
    if (val.length > NIK_LEN) {
      val = val.slice(0, NIK_LEN);
      toast.error(`Maksimal ${NIK_LEN} digit`);
    }
    setForm((prev) => ({ ...prev, nik: val }));
    // reset error khusus field saat user mengetik lagi
    if (fieldErrors.nik) setFieldErrors((fe) => ({ ...fe, nik: '' }));
  };

  const handleEmailChange = (e) => {
    setForm((prev) => ({ ...prev, email: e.target.value }));
    if (fieldErrors.email) setFieldErrors((fe) => ({ ...fe, email: '' }));
  };

  const handlePhoneChange = (e) => {
    setForm((prev) => ({ ...prev, phone: e.target.value }));
    if (fieldErrors.phone) setFieldErrors((fe) => ({ ...fe, phone: '' }));
  };

  useEffect(() => {
    fetchEmployees(page, search);
  }, [page, search, fetchEmployees]);

  useEffect(() => {
    setFiltered(employees);
  }, [employees]);

  useEffect(() => {
    const result = employees.filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.nik?.includes(search)
    );
    setFiltered(result);
  }, [search, employees]);

  // Util: parsing error dari backend untuk cari field duplicate
  const parseApiError = (err) => {
    // Struktur umum yang sering dipakai (Laravel, Nest/Zod/Yup, dsb.):
    // - err.response.status: 409/422
    // - err.response.data: { message, field, errors: { nik: [...], email: [...], phone: [...] } }
    const res = err?.response;
    const data = res?.data || {};
    const errors = data?.errors || {};
    const message = data?.message || '';

    const out = { nik: '', email: '', phone: '', global: '' };

    // 1) Kalau ada objek "errors" per-field
    if (errors.nik?.length) out.nik = errors.nik[0];
    if (errors.email?.length) out.email = errors.email[0];
    if (errors.phone?.length) out.phone = errors.phone[0];

    // 2) Kalau backend mengirim { field: 'nik', message: '...' }
    if (data.field && data.message) {
      if (['nik', 'email', 'phone'].includes(data.field)) {
        out[data.field] = data.message;
      } else {
        out.global = data.message;
      }
    }

    // 3) Fallback: deteksi substring pada message
    const lower = (message || '').toLowerCase();
    if (!out.nik && /nik/.test(lower) && /sudah digunakan|already exists|duplicate/.test(lower)) {
      out.nik = 'NIK sudah digunakan';
    }
    if (!out.email && /(email|e-mail)/.test(lower) && /sudah digunakan|already exists|duplicate/.test(lower)) {
      out.email = 'Email sudah digunakan';
    }
    if (!out.phone && /(phone|no.?hp|nomor.?hp|telepon|telp)/.test(lower) && /sudah digunakan|already exists|duplicate/.test(lower)) {
      out.phone = 'No. HP sudah digunakan';
    }

    // 4) Status khusus
    if (res?.status === 409 && !out.global && !out.nik && !out.email && !out.phone) {
      out.global = 'Data duplikat';
    }

    return out;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // reset field errors
    setFieldErrors({ nik: '', email: '', phone: '' });

    if (!form.store_id) {
      toast.error('Pilih toko dulu');
      return;
    }

    // Validasi NIK tepat 8 digit
    if (!nikIsAllDigits) {
      toast.error('NIK hanya boleh berisi angka');
      return;
    }
    if (nikLength < NIK_LEN) {
      toast.error(`NIK minimal ${NIK_LEN} digit`);
      return;
    }
    if (nikLength > NIK_LEN) {
      toast.error(`NIK maksimal ${NIK_LEN} digit`);
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateEmployee(editing.id, form);
      } else {
        await addEmployee(form);
      }
      setForm({
        store_id: '',
        name: '',
        nik: '',
        gender: '',
        email: '',
        phone: '',
        status: ''
      });
      setEditing(null);
      setShowModal(false);
      toast.success('✅ Data karyawan berhasil disimpan!');
    } catch (err) {
      // Tangani error duplikat
      const fe = parseApiError(err);

      if (fe.nik) toast.error('NIK sudah digunakan');
      if (fe.email) toast.error('Email sudah digunakan');
      if (fe.phone) toast.error('No. HP sudah digunakan');
      if (!fe.nik && !fe.email && !fe.phone) {
        // selain duplikat, tampilkan pesan umum
        toast.error(fe.global || '❌ Terjadi kesalahan saat menyimpan data');
      }

      // set inline error di bawah input
      setFieldErrors({
        nik: fe.nik || '',
        email: fe.email || '',
        phone: fe.phone || ''
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee) => {
    setForm({
      store_id: employee.store?.id || '',
      nik: employee.nik || '',
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      gender: employee.gender || '',
      status: employee.status || ''
    });
    setFieldErrors({ nik: '', email: '', phone: '' });
    setEditing(employee);
    setShowModal(true);
  };

  const handleDelete = (id, name) => {
    Swal.fire({
      title: 'Yakin ingin menghapus?',
      text: `Data karyawan "${name}" akan dihapus secara permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteEmployee(id);
          Swal.fire('Berhasil!', 'Data karyawan telah dihapus.', 'success');
        } catch (error) {
          Swal.fire('Gagal!', 'Terjadi kesalahan saat menghapus data.', 'error');
        }
      }
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Kelola Data Karyawan</h2>

      <div className="mb-4 flex flex-col sm:flex-row items-center gap-2">
        <Input
          type="text"
          placeholder="Cari nama atau NIK..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80"
        />
      </div>

      {/* Tombol Tambah */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            setEditing(null);
            setForm({
              store_id: '',
              name: '',
              nik: '',
              gender: '',
              email: '',
              phone: '',
              status: ''
            });
            setFieldErrors({ nik: '', email: '', phone: '' });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200"
        >
          <DocumentIcon className="w-5 h-5" />
          Tambah Karyawan
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Nama</th>
                <th className="p-2 border">NIK</th>
                <th className="p-2 border">Gender</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Toko</th>
                <th className="p-2 border">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{emp.name}</td>
                  <td className="p-2 border">{emp.nik}</td>
                  <td className="p-2 border capitalize">{emp.gender}</td>
                  <td className="p-2 border capitalize">{emp.status}</td>
                  <td className="p-2 border">
                    {emp.store?.name || '-'} ({emp.store?.code || '*'})
                  </td>
                  <td className="flex justify-center gap-2 p-2 border space-x-2">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="inline-flex items-center gap-1 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit
                    </button>
                    {user?.id !== emp.id && (
                      <button
                        onClick={() => handleDelete(emp.id, emp.name)}
                        className="inline-flex items-center gap-1 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Hapus
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-2 mt-4">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100 transition"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              Prev
            </button>

            {Array.from({ length: pagination.lastPage }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 border rounded hover:bg-gray-100 transition ${
                    pageNum === page ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}

            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.lastPage}
              className="flex items-center gap-1 px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-100 transition"
            >
              Next
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 w-full max-w-3xl rounded-xl shadow-lg relative">
            <button
              onClick={() => {
                setShowModal(false);
                setEditing(null);
              }}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500 text-xl"
            >
              ✕
            </button>
            <h3 className="text-xl font-semibold mb-4">
              {editing ? 'Edit Karyawan' : 'Tambah Karyawan'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Toko */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    Toko
                  </label>
                  <select
                    value={form.store_id}
                    onChange={(e) =>
                      setForm({ ...form, store_id: e.target.value })
                    }
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Pilih Toko</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.store_name} ({s.store_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nama */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    Nama
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nama"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="Masukkan email"
                    value={form.email}
                    onChange={handleEmailChange}
                    className={`px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                      fieldErrors.email
                        ? 'border-red-500 focus:ring-red-400'
                        : 'focus:ring-blue-500'
                    }`}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby="email-error"
                    required
                  />
                  {fieldErrors.email && (
                    <span id="email-error" className="mt-1 text-xs text-red-600 font-medium">
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                {/* Nomor HP */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    No. HP
                  </label>
                  <input
                    type="text"
                    placeholder="Masukkan nomor HP"
                    value={form.phone}
                    onChange={handlePhoneChange}
                    className={`px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                      fieldErrors.phone
                        ? 'border-red-500 focus:ring-red-400'
                        : 'focus:ring-blue-500'
                    }`}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby="phone-error"
                  />
                  {fieldErrors.phone && (
                    <span id="phone-error" className="mt-1 text-xs text-red-600 font-medium">
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>

                {/* NIK */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    NIK
                  </label>
                  <input
                    inputMode="numeric"
                    placeholder="Masukkan NIK"
                    value={form.nik}
                    onChange={handleNikChange}
                    className={`px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                      nikError ? 'border-red-500 focus:ring-red-400' : 'focus:ring-blue-500'
                    }`}
                    aria-invalid={!!nikError}
                    aria-describedby="nik-help nik-error"
                    maxLength={16}
                    required
                  />
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span id="nik-help" className="text-gray-500">
                      {nikLength}/{NIK_LEN} digit
                    </span>
                    {nikError && (
                      <span id="nik-error" className="text-red-600 font-medium">
                        {nikError}
                      </span>
                    )}
                  </div>
                </div>

                {/* Gender */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    Gender
                  </label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value })
                    }
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Pilih Gender</option>
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>

                {/* Status */}
                <div className="flex flex-col">
                  <label className="mb-1 text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Pilih Status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="text-right pt-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
                  disabled={submitting || !nikIsValid}
                >
                  {submitting ? 'Menyimpan...' : editing ? 'Update' : 'Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white px-6 py-4 rounded shadow-lg text-center">
            <span className="text-lg font-semibold text-gray-700">
              Menyimpan data karyawan...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

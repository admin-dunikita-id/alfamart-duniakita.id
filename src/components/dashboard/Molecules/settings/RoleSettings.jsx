import React from "react";
import api from "@/config/api"; // axios instance kamu

function getErr(err, fb = "Terjadi kesalahan") {
  return err?.response?.data?.message || err?.message || fb;
}

const PERM_FIELDS = [
  { key: "can_request_leave", label: "Bisa Ajukan Cuti/Izin/Sakit" },
  { key: "can_approve_leave", label: "Bisa Approve Cuti/Izin/Sakit" },
  { key: "can_request_swap", label: "Bisa Ajukan Tukar Shift" },
  { key: "can_approve_swap", label: "Bisa Approve Tukar Shift" },
  { key: "is_global_admin", label: "Admin Global (approve semua)" },
];

export default function RoleSettings() {
  const [roles, setRoles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    can_request_leave: true,
    can_approve_leave: false,
    can_request_swap: true,
    can_approve_swap: false,
    is_global_admin: false,
    default_approver_role_for_leave: "supervisor",
    default_approver_role_for_swap: "cos",
  });

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/roles");
      // terima baik format {data:[]} atau langsung array
      setRoles(data?.data || data || []);
    } catch (e) {
      console.error(getErr(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchRoles(); }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!form.name?.trim()) return alert("Nama role wajib diisi");
    setSaving(true);
    try {
      await api.post("/api/roles", form);
      setForm({
        name: "",
        description: "",
        can_request_leave: true,
        can_approve_leave: false,
        can_request_swap: true,
        can_approve_swap: false,
        is_global_admin: false,
        default_approver_role_for_leave: "supervisor",
        default_approver_role_for_swap: "cos",
      });
      fetchRoles();
    } catch (e) {
      window.alert(getErr(e));
    } finally {
      setSaving(false);
    }
  };

  const patchRole = async (id, payload) => {
    // optimistik UI
    setRoles((rs) => rs.map((r) => (r.id === id ? { ...r, ...payload } : r)));
    try {
      await api.put(`/api/roles/${id}`, payload);
    } catch (e) {
      window.alert(getErr(e));
      fetchRoles(); // rollback
    }
  };

const removeRole = async (id) => {
  if (!window.confirm("Hapus role ini?")) return;
  try {
    await api.delete(`/api/roles/${id}`);
    setRoles((rs) => rs.filter((r) => r.id !== id));
  } catch (e) {
    window.alert(getErr(e));
  }
};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Role & Permission</h2>
        <button
          onClick={fetchRoles}
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
        >
          Segarkan
        </button>
      </div>

      {/* Form Tambah Role */}
      <form
        onSubmit={submit}
        className="grid gap-3 md:grid-cols-3 items-start bg-gray-50 p-4 rounded-xl border"
      >
        <div className="md:col-span-1">
          <label className="block text-sm text-gray-600 mb-1">Nama Role</label>
          <input
            required
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value
                  .toLowerCase()
                  .replace(/\s+/g, "_")
                  .replace(/[^a-z0-9_]/g, ""),
              })
            }
            placeholder="contoh: supervisor"
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            Disarankan huruf kecil & underscore (mis: <code>cos</code>,{" "}
            <code>acos</code>, <code>supervisor</code>).
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600 mb-1">Deskripsi</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded px-3 py-2"
            placeholder="opsional"
          />
        </div>

        <div className="md:col-span-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PERM_FIELDS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form[p.key]}
                onChange={(e) =>
                  setForm({ ...form, [p.key]: e.target.checked })
                }
              />
              {p.label}
            </label>
          ))}
        </div>

        <div className="md:col-span-3 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Approver default (Cuti/Izin/Sakit)
            </label>
            <input
              value={form.default_approver_role_for_leave}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_approver_role_for_leave: e.target.value,
                })
              }
              className="w-full border rounded px-3 py-2"
              placeholder="mis: supervisor / cos / admin"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Approver default (Tukar Shift)
            </label>
            <input
              value={form.default_approver_role_for_swap}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_approver_role_for_swap: e.target.value,
                })
              }
              className="w-full border rounded px-3 py-2"
              placeholder="mis: cos"
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <button
            disabled={saving}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Tambah Role"}
          </button>
        </div>
      </form>

      {/* Tabel Role */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-3">Nama</th>
              <th className="p-3">Deskripsi</th>
              <th className="p-3">Permission</th>
              <th className="p-3">Approver Default</th>
              <th className="p-3 w-32 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={5}>
                  Memuat…
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>
                  Belum ada role
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    <input
                      className="border rounded px-2 py-1 w-44"
                      value={r.name || ""}
                      onChange={(e) =>
                        setRoles((rs) =>
                          rs.map((x) =>
                            x.id === r.id ? { ...x, name: e.target.value } : x
                          )
                        )
                      }
                      onBlur={(e) =>
                        patchRole(r.id, {
                          name: e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_]/g, ""),
                        })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      value={r.description || ""}
                      onChange={(e) =>
                        setRoles((rs) =>
                          rs.map((x) =>
                            x.id === r.id
                              ? { ...x, description: e.target.value }
                              : x
                          )
                        )
                      }
                      onBlur={(e) =>
                        patchRole(r.id, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {PERM_FIELDS.map((p) => (
                        <label key={p.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!r[p.key]}
                            onChange={(e) => {
                              const val = e.target.checked;
                              patchRole(r.id, { [p.key]: val });
                            }}
                          />
                          <span className="truncate">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        className="border rounded px-2 py-1"
                        value={r.default_approver_role_for_leave || ""}
                        onChange={(e) =>
                          setRoles((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    default_approver_role_for_leave:
                                      e.target.value,
                                  }
                                : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          patchRole(r.id, {
                            default_approver_role_for_leave: e.target.value,
                          })
                        }
                        placeholder="mis: supervisor"
                      />
                      <input
                        className="border rounded px-2 py-1"
                        value={r.default_approver_role_for_swap || ""}
                        onChange={(e) =>
                          setRoles((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    default_approver_role_for_swap:
                                      e.target.value,
                                  }
                                : x
                            )
                          )
                        }
                        onBlur={(e) =>
                          patchRole(r.id, {
                            default_approver_role_for_swap: e.target.value,
                          })
                        }
                        placeholder="mis: cos"
                      />
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => removeRole(r.id)}
                      className="px-3 py-1 rounded bg-red-600 text-white"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Rekomendasi aturan (bisa kamu terapkan di backend):
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>Admin global bisa approve semua (cek <code>is_global_admin</code>).</li>
          <li>
            COS boleh approve cuti untuk Employee & ACOS, dan boleh approve
            tukar shift miliknya sendiri.
          </li>
          <li>
            Supervisor jadi approver default cuti untuk COS (atur di{" "}
            <code>default_approver_role_for_leave</code>).
          </li>
        </ul>
      </div>
    </div>
  );
}

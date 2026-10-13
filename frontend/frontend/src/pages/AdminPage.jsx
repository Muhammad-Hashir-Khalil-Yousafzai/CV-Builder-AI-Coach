import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import {
  Search, ShieldPlus, Users, ShieldCheck, Loader2, UserPlus, Mail, Lock, User as UserIcon,
} from "lucide-react";
import api from "../api/axios";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [newAdmin, setNewAdmin] = useState({ email: "", first_name: "", last_name: "", password: "" });
  const [creating, setCreating] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users/", {
        params: { search: search || undefined, role: roleFilter || undefined },
      });
      setUsers(Array.isArray(data) ? data : data.results);
    } catch {
      toast.error("Couldn't load users - are you logged in as an admin?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/admin/admins/", newAdmin);
      toast.success(`${newAdmin.email} is now an admin`);
      setNewAdmin({ email: "", first_name: "", last_name: "", password: "" });
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.email?.[0] || "Couldn't create admin");
    } finally {
      setCreating(false);
    }
  };

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="min-h-screen bg-[#F5F6F3]">
      <div className="max-w-6xl mx-auto p-6 lg:p-10 space-y-8">
        {/* --- Header --- */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-semibold text-[#1B1F27] tracking-tight">Admin panel</h1>
            <p className="text-sm text-[#6B7280] mt-1">Manage registered users and admin access.</p>
          </div>
          <div className="flex gap-3">
            <StatPill icon={Users} label="Total users" value={users.length} />
            <StatPill icon={ShieldCheck} label="Admins" value={adminCount} accent />
          </div>
        </motion.div>

        {/* --- Create another admin --- */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-[#E4E1D9] p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <ShieldPlus size={18} className="text-[#1B1F27]" />
            <h2 className="font-semibold text-[#1B1F27]">Add a new admin</h2>
          </div>

          <form onSubmit={createAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              icon={Mail}
              placeholder="Email"
              type="email"
              required
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
            />
            <InputField
              icon={Lock}
              placeholder="Password"
              type="password"
              required
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
            />
            <InputField
              icon={UserIcon}
              placeholder="First name"
              value={newAdmin.first_name}
              onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
            />
            <InputField
              icon={UserIcon}
              placeholder="Last name"
              value={newAdmin.last_name}
              onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
            />

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={creating}
              className="sm:col-span-2 flex items-center justify-center gap-2 rounded-lg bg-[#1B1F27] text-white py-2.5 text-sm font-medium disabled:opacity-60 hover:bg-[#2A2F3A] transition-colors"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              {creating ? "Creating..." : "Create admin"}
            </motion.button>
          </form>
        </motion.section>

        {/* --- All registered users --- */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-[#E4E1D9] p-6"
        >
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#E4E1D9] bg-[#FAFAF8] outline-none focus:border-[#1B1F27] transition-colors"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 text-sm rounded-lg border border-[#E4E1D9] bg-[#FAFAF8] outline-none focus:border-[#1B1F27] transition-colors"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[#9CA3AF] text-sm">
              <Loader2 size={16} className="animate-spin" /> Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#9CA3AF] border-b border-[#E4E1D9]">
                    <th className="py-2.5 font-medium">Name</th>
                    <th className="font-medium">Email</th>
                    <th className="font-medium">Role</th>
                    <th className="font-medium">Joined</th>
                    <th className="font-medium">Last login</th>
                    <th className="font-medium">Last IP</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {users.map((u) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-[#F1EFE9] last:border-0 hover:bg-[#FAFAF8] transition-colors"
                      >
                        <td className="py-3 text-[#1B1F27] font-medium">
                          {u.first_name} {u.last_name}
                        </td>
                        <td className="text-[#4B5563]">{u.email}</td>
                        <td>
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="text-[#6B7280]">{new Date(u.date_joined).toLocaleDateString()}</td>
                        <td className="text-[#6B7280]">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}
                        </td>
                        <td className="text-[#6B7280]">{u.last_login_ip || "—"}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-[#9CA3AF]">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${
        accent ? "bg-[#1B1F27] text-white border-[#1B1F27]" : "bg-white text-[#1B1F27] border-[#E4E1D9]"
      }`}
    >
      <Icon size={15} className={accent ? "text-white/80" : "text-[#6B7280]"} />
      <div className="leading-tight">
        <div className="text-sm font-semibold">{value}</div>
        <div className={`text-[10px] ${accent ? "text-white/70" : "text-[#9CA3AF]"}`}>{label}</div>
      </div>
    </div>
  );
}

function InputField({ icon: Icon, ...props }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#E4E1D9] bg-[#FAFAF8] px-3 py-2 focus-within:border-[#1B1F27] transition-colors">
      <Icon size={15} className="text-[#9CA3AF] shrink-0" />
      <input {...props} className="w-full bg-transparent outline-none text-sm" />
    </div>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
        isAdmin ? "bg-[#1B1F27] text-white" : "bg-[#F1EFE9] text-[#6B7280]"
      }`}
    >
      {role}
    </span>
  );
}
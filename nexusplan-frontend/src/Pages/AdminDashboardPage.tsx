import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { ShieldAlert, Trash2, PowerOff, Power } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.is_superuser) return;

    const fetchData = async () => {
      try {
        const usersRes = await api.get('/auth/admin/users/');
        setUsers(usersRes.data);
        const projRes = await api.get('/projects/admin/all/');
        setProjects(projRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const toggleBan = async (id: string) => {
    try {
      const res = await api.post(`/auth/admin/users/${id}/ban/`);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.data.is_active } : u));
    } catch (e) {
      console.error(e);
      alert('Failed to ban user (Cannot ban superusers)');
    }
  };

  if (!user?.is_superuser) {
    return <div className="p-8 text-center text-red-500">Forbidden: Superadmin only</div>;
  }

  if (loading) return <div className="p-8">Loading admin dashboard...</div>;

  return (
    <div className="p-8 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <ShieldAlert size={32} className="text-red-500" />
        <h1 className="text-2xl font-bold text-gray-800">Superadmin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* USERS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">All Users ({users.length})</h2>
          <div className="overflow-y-auto max-h-[60vh] -mx-4 px-4">
            {users.map(u => (
              <motion.div key={u.id} layout className="flex items-center justify-between p-3 border-b border-gray-50 hover:bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {u.avatar ? (
                    <img src={u.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {u.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-sm text-gray-800">{u.username} {u.is_superuser && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-2">Admin</span>}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Banned'}
                  </span>
                  {!u.is_superuser && (
                    <button onClick={() => toggleBan(u.id)} className="p-2 rounded hover:bg-gray-200 text-gray-500 hover:text-red-600 transition-colors" title={u.is_active ? "Ban User" : "Unban User"}>
                      {u.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* PROJECTS */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">All Projects ({projects.length})</h2>
          <div className="overflow-y-auto max-h-[60vh] -mx-4 px-4">
            {projects.map(p => {
              // find owner
              const owner = users.find(u => u.id === p.ownerId);
              return (
                <div key={p.id} className="flex flex-col p-3 border-b border-gray-50 hover:bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-sm text-gray-800">{p.name}</h3>
                    <span className="text-xs text-gray-500">{p.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-1">{p.description || 'No description'}</p>
                  <p className="text-xs text-gray-400">Owner: {owner ? owner.email : p.ownerId}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;

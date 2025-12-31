import { useState, useEffect, useMemo } from 'react';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Download, 
  FileText, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  invoiceCount?: number; // Optional: helpful to show how many invoices a user has
}

export default function InvoiceManager() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Track which specific user is currently having their invoices downloaded
  const [downloadingUserId, setDownloadingUserId] = useState<string | null>(null);
  
  // Track if the global "Download All" is in progress
  const [isGlobalDownloading, setIsGlobalDownloading] = useState(false);

  const authHeaders = useMemo(() => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth?.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
      return headers;
    }, [auth?.token]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: authHeaders as any
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // 1. Function to download ALL invoices (Global Bulk Export)
  // This uses the snippet you provided
  const handleDownloadAllGlobal = async () => {
    try {
      setIsGlobalDownloading(true);
      setError(null);

      const res = await fetch(`/api/invoices/all-pdfs`, {
        method: 'GET',
        headers: authHeaders as any,
      });

      if (!res.ok) throw new Error('Failed to download global invoices');

      // Create blob link to download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all_users_invoices_${new Date().toISOString().split('T')[0]}.zip`; 
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError('Failed to download all invoices. Please try again.');
      console.error(err);
    } finally {
      setIsGlobalDownloading(false);
    }
  };

  // 2. Function to download invoices for a SINGLE user
  const handleDownloadUserInvoices = async (userId: string, userName: string) => {
    try {
      setDownloadingUserId(userId);
      setError(null);

      // Assumed endpoint for single user - Adjust URL as needed
      const res = await fetch(`/api/invoices/user/${userId}/download`, {
        method: 'GET',
        headers: authHeaders as any,
      });

      if (!res.ok) throw new Error('Failed to download user invoices');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userName.replace(/\s+/g, '_')}_invoices.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(`Could not download invoices for ${userName}`);
    } finally {
      setDownloadingUserId(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Invoice Management</h1>
          <p className="text-gray-500 mt-1">View and export invoices for all registered users.</p>
        </div>
        
        {/* Global Download Button */}
        <button
          onClick={handleDownloadAllGlobal}
          disabled={isGlobalDownloading}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm font-medium"
        >
          {isGlobalDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {isGlobalDownloading ? 'Preparing Export...' : 'Download All Invoices'}
        </button>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 border border-red-100"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center items-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <motion.tr 
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50/80 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDownloadUserInvoices(user.id, user.name)}
                          disabled={downloadingUserId === user.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
                          title="Download User Invoices"
                        >
                          {downloadingUserId === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">
                            {downloadingUserId === user.id ? 'Downloading...' : 'Get Invoices'}
                          </span>
                        </button>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 opacity-20" />
                        <p>No users found matching your search</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
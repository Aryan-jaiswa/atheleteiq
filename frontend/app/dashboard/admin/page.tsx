'use client';

import { useAuth } from '@/hooks/useAuth';
import { RoleGuard } from '@/components/RoleGuard';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Platform Administration</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* System Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Total Users</p>
              <p className="text-3xl font-bold text-blue-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Videos Processed</p>
              <p className="text-3xl font-bold text-green-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">Processing Queue</p>
              <p className="text-3xl font-bold text-purple-600">0</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm">System Health</p>
              <p className="text-3xl font-bold text-green-600">✓</p>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">👥</div>
              <h3 className="text-lg font-bold text-gray-800">Manage Users</h3>
              <p className="text-gray-600 text-sm mt-2">Create, edit, and manage all user accounts and roles</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">⚙️</div>
              <h3 className="text-lg font-bold text-gray-800">System Settings</h3>
              <p className="text-gray-600 text-sm mt-2">Configure platform settings and integrations</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📋</div>
              <h3 className="text-lg font-bold text-gray-800">Audit Logs</h3>
              <p className="text-gray-600 text-sm mt-2">View system activity and audit trails</p>
            </div>
          </div>

          {/* Database Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Database Management</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  View Database Stats
                </button>
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  Backup Database
                </button>
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  Run Migrations
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">External Services</h2>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  Firebase Configuration
                </button>
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  GCS Bucket Settings
                </button>
                <button className="w-full px-4 py-2 text-left text-blue-600 hover:text-blue-700 font-medium">
                  Gemini API Status
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent System Activity</h2>
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}

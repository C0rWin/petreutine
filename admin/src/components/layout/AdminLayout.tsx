import React from 'react';
import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}

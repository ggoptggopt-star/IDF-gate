'use client';

import React from 'react';
import Link from 'next/link';
import ApproverDashboard from '@/components/ApproverDashboard';
import { ChevronLeft } from 'lucide-react';

export default function ApproverPage() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 pt-2">
        <Link href="/" className="p-1 -ml-1 text-slate-700 hover:text-slate-900">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-bold text-slate-800">แดชบอร์ดผู้อนุมัติ 5 ขั้นตอน</h1>
      </div>

      <ApproverDashboard />
    </div>
  );
}

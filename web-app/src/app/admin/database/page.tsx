'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  ChevronLeft,
  RefreshCw,
  Download,
  Search,
  Table as TableIcon,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';

interface TableSummary {
  name: string;
  thaiName: string;
  desc: string;
  count: number;
}

interface CurrentTableData {
  name: string;
  thaiName: string;
  desc: string;
  columns: string[];
  rows: any[];
  total: number;
}

export default function DatabaseViewerPage() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [tableData, setTableData] = useState<CurrentTableData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/db-tables?table=${tableName}`);
      const data = await res.json();
      if (data.success) {
        setTables(data.tables || []);
        setTableData(data.currentTable || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData(selectedTable);
  }, [selectedTable]);

  // Export current table to CSV
  const handleExportCsv = () => {
    if (!tableData || tableData.rows.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = tableData.columns.join(',');
    const rows = tableData.rows.map((row) =>
      tableData.columns
        .map((col) => {
          let val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          // Escape quotes and commas
          val = val.replace(/"/g, '""');
          if (val.includes(',') || val.includes('\n') || val.includes('"')) {
            val = `"${val}"`;
          }
          return val;
        })
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // UTF-8 BOM for Thai support in Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${tableData.name}_oicec.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rows based on search
  const filteredRows =
    tableData?.rows.filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(q)
      );
    }) || [];

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto min-h-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1 -ml-1 text-slate-700 hover:text-slate-900">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#0066CC]" />
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                SQLite Database Viewer (ศูนย์ตรวจดูฐานข้อมูล)
              </h1>
            </div>
            <p className="text-[11px] text-slate-500">
              smart_gate.db • 7 ตารางหลัก วิทยาลัยการอาชีพองครักษ์
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchTableData(selectedTable)}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* 7 Table Selector Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
        {tables.map((t) => {
          const isSelected = selectedTable === t.name;
          return (
            <button
              key={t.name}
              onClick={() => setSelectedTable(t.name)}
              className={`p-2.5 rounded-2xl text-left border transition-all ${
                isSelected
                  ? 'bg-[#0066CC] text-white border-[#0066CC] shadow-sm font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="font-mono text-[11px] truncate">{t.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {t.count}
                </span>
              </div>
              <p
                className={`text-[10px] truncate ${
                  isSelected ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {t.thaiName}
              </p>
            </button>
          );
        })}
      </div>

      {/* Table Data View Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Info & Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">
                ตาราง: <span className="font-mono text-[#0066CC]">{tableData?.name}</span> (
                {tableData?.thaiName})
              </h2>
              <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded-full">
                {filteredRows.length} แถว
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{tableData?.desc}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาในตาราง..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
              title="ดาวน์โหลดเป็นไฟล์ CSV ไปเปิดใน Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>กำลังดึงข้อมูลจาก SQLite...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <span>ไม่พบข้อมูลที่ตรงกับการค้นหา</span>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[60vh] no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100/90 sticky top-0 z-10 backdrop-blur-xs text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold text-[11px] font-mono text-slate-400 w-12 text-center">
                    #
                  </th>
                  {tableData?.columns.map((col) => (
                    <th key={col} className="py-2.5 px-3 font-bold text-[11px] font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2 px-3 text-[10px] text-slate-400 text-center font-mono">
                      {idx + 1}
                    </td>
                    {tableData?.columns.map((col) => {
                      const val = row[col];
                      let displayVal = val;

                      // Truncate long JSON vectors or sample image paths
                      if (typeof val === 'string' && val.length > 40 && (col.includes('vector') || col.includes('subscription'))) {
                        displayVal = val.slice(0, 30) + '... (JSON)';
                      }

                      // Badge styles for specific columns
                      let badgeClass = '';
                      if (col === 'role') {
                        badgeClass = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200';
                      } else if (col === 'overall_status') {
                        badgeClass =
                          val === 'approved'
                            ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : val === 'rejected'
                            ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200'
                            : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200';
                      }

                      return (
                        <td
                          key={col}
                          className="py-2 px-3 whitespace-nowrap max-w-xs truncate font-mono text-[11px]"
                          title={String(val ?? '')}
                        >
                          {badgeClass ? (
                            <span className={badgeClass}>{String(val)}</span>
                          ) : val === null || val === undefined ? (
                            <span className="text-slate-300 italic">null</span>
                          ) : (
                            String(displayVal)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

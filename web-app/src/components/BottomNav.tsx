'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, MessageSquare, ScanFace, User } from 'lucide-react';

function BottomNavContent() {
  const pathname = usePathname();

  // Hide bottom nav on login or live trip pages
  if (pathname === '/login' || pathname.startsWith('/trip')) {
    return null;
  }

  const tabs = [
    { href: '/', label: 'หน้าแรก', icon: Home },
    { href: '/chat', label: 'แชทขออนุญาต', icon: MessageSquare, hasBadge: true },
    { href: '/gate', label: 'สแกนไม้กั้น', icon: ScanFace },
    { href: '/profile', label: 'โปรไฟล์', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="w-full max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto grid grid-cols-4 h-16 md:h-18 px-2 md:px-6">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center transition-colors relative py-1 ${
                isActive ? 'text-[#0066CC] font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5.5 h-5.5 md:w-6 md:h-6 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white"></span>
                )}
              </div>
              <span className="text-[11px] md:text-xs mt-1 tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function BottomNav() {
  return (
    <React.Suspense fallback={null}>
      <BottomNavContent />
    </React.Suspense>
  );
}

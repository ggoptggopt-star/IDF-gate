import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import DemoRoleSwitcher from '@/components/DemoRoleSwitcher';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Smart Gate Pass AI — วิทยาลัยการอาชีพองครักษ์ (OICEC)',
  description: 'ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <meta name="theme-color" content="#0066CC" />
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="antialiased bg-slate-900 min-h-screen text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
        <AuthProvider>
          {/* Top Demo Bar for Easy Presentation & Grading */}
          <DemoRoleSwitcher />

          {/* Mobile-First Centered Container */}
          <div className="max-w-md mx-auto min-h-screen bg-[#F4F7FB] shadow-2xl relative flex flex-col pb-20">
            {children}
            <BottomNav />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

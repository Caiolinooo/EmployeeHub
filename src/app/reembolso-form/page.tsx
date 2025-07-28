'use client';

import React from 'react';
import Image from 'next/image';
import ReimbursementFormWrapper from '@/components/ReimbursementFormWrapper';
import Footer from '@/components/Footer';
import 'react-toastify/dist/ReactToastify.css';

export default function PublicReimbursementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100">
      <div className="container mx-auto py-12 px-4">
        {/* Header with logo */}
        <header className="text-center mb-12" style={{ opacity: 1, visibility: 'visible' }}>
          <div className="flex justify-center">
            <Image
              src="/images/LC1_Azul.png"
              alt="ABZ Group Logo"
              width={250}
              height={60}
              priority
            />
          </div>
        </header>

        {/* Main form with profile data if available */}
        <ReimbursementFormWrapper />

        {/* Footer */}
        <div className="mt-16" style={{ opacity: 1, visibility: 'visible' }}>
          <Footer />
        </div>
      </div>
    </div>
  );
}

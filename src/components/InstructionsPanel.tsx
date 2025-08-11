'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';

const InstructionsPanel: React.FC = () => {
  const [show, setShow] = useState(false);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [showContactButtons, setShowContactButtons] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollThreshold = documentHeight - windowHeight - 100; // 100px before the end

      if (scrollTop >= scrollThreshold) {
        setReachedBottom(true);
      } else {
        setReachedBottom(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const onClose = () => {
    setShow(false);
  };

  // Standard Blue Button Style (Apply identified style)
  const standardButtonStyle = "px-6 py-3 bg-abz-blue-dark text-white rounded-lg font-semibold hover:bg-opacity-90 transition duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed";
  // const secondaryButtonStyle = "px-5 py-2 bg-gray-600 text-white rounded-md font-medium hover:bg-gray-700 transition duration-150 text-sm shadow-sm";
  const whatsappButtonStyle = "px-5 py-2 bg-green-500 text-white rounded-md font-medium hover:bg-green-600 transition duration-150 text-sm shadow-sm flex items-center";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-4xl">
        <h2 className="text-2xl font-semibold mb-6">Understand Instructions</h2>
        <AnimatePresence>
          {show && (
            <div className="h-[300px] overflow-y-auto">
              {/* Add your content here */}
            </div>
          )}
        </AnimatePresence>
        {/* Footer with Action Button */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between sticky bottom-0 z-10">
          <AnimatePresence>
            {reachedBottom && showContactButtons && (
                <motion.div
                    className="flex items-center space-x-3 mb-4 sm:mb-0"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                 >
                    <span className="text-sm text-gray-600">Ainda com dúvidas?</span>
                    <a
                        href="https://wa.me/5522992074646" // Replace with your WhatsApp number
                        target="_blank"
                        rel="noopener noreferrer"
                        className={whatsappButtonStyle}
                    >
                        <FaWhatsapp className="mr-2" /> Chamar no Zap
                    </a>
                </motion.div>
            )}
          </AnimatePresence>
          <button
            className={`${standardButtonStyle} w-full sm:w-auto`} // Apply standard style here
            onClick={onClose}
            disabled={!reachedBottom} // Enable only after scrolling down
          >
            {reachedBottom ? 'Compreendi as Instruções' : 'Role até o final para continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPanel;

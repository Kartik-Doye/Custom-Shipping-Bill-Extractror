import React from 'react';
import { Sun, Zap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b-2 border-brand-primary sticky top-0 z-50 h-20 flex items-center shadow-lg">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Solar Red & Navy Logo Area */}
          <div className="flex items-center gap-3">
            <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-red-100">
                <Sun className="w-6 h-6 text-white animate-spin-slow" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-brand-secondary tracking-tighter leading-none">
                SOLAR <span className="text-brand-primary">CUSTOMS</span>
              </span>
              <span className="text-[10px] font-bold text-brand-secondary/60 uppercase tracking-widest mt-1">
                Extraction Intelligence
              </span>
            </div>
          </div>

          {/* System Status / Meta */}
          <div className="flex items-center gap-6">
             <div className="hidden md:block text-right mr-4 border-r border-brand-border pr-6">
                <p className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Automated Grid</p>
                <p className="text-[9px] text-brand-primary uppercase tracking-widest font-black">NAVY-RED INTERFACE</p>
             </div>
             <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
                <Zap className="w-3 h-3 text-brand-primary fill-brand-primary animate-pulse" />
                <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">
                    AI Active
                </span>
             </div>
          </div>
        </div>
      </div>
    </header>
  );
};
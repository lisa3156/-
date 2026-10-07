import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  icon: LucideIcon;
  colorClass: string;
  onClick?: () => void;
  actionButton?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  colorClass, 
  onClick,
  actionButton 
}) => {
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm p-5 border border-[#AC9B95]/30 flex items-center justify-between relative transition-all ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-[#8D4429]/40' : ''
      }`}
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        <div className={`p-3 rounded-xl ${colorClass} bg-opacity-15 flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-[#8C776D] truncate">{title}</p>
          <div className="text-xl sm:text-2xl font-bold text-[#3A2923] truncate tracking-tight">{value}</div>
          {subValue && <div className="text-xs text-[#9B8072] mt-0.5 truncate">{subValue}</div>}
        </div>
      </div>
      {actionButton && (
        <div className="flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {actionButton}
        </div>
      )}
    </div>
  );
};

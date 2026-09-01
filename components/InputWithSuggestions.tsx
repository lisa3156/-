import React, { useState, useRef, useEffect } from 'react';

interface InputWithSuggestionsProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
}

export const InputWithSuggestions: React.FC<InputWithSuggestionsProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  required
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredSuggestions = suggestions.filter(
    (item) => item.toLowerCase().includes(value.toLowerCase()) && item !== value
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-[#2C3842] mb-1">
        {label} {required && <span className="text-[#D87048]">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6994] focus:border-[#2D6994] transition-colors text-base md:text-sm text-[#2C3842]"
        placeholder={placeholder}
        required={required}
      />
      
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white mt-1 border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-3 py-2 hover:bg-[#EAF3F8] hover:text-[#2D6994] cursor-pointer text-sm text-[#2C3842] font-medium"
              onClick={() => {
                onChange(suggestion);
                setShowSuggestions(false);
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
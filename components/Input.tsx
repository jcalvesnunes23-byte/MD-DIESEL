
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[11px] font-bold uppercase text-slate-500 tracking-tight ml-0.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 font-medium text-slate-800 outline-none focus:border-[#1b2e85] focus:ring-2 focus:ring-[#1b2e85]/5 transition-all placeholder:text-slate-400 text-sm shadow-sm"
      />
    </div>
  );
};

export default Input;

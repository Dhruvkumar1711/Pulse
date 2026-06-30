import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Loader2, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  ChevronsUpDown, 
  AlertCircle, 
  X, 
  Sparkles, 
  Inbox,
  ArrowUpDown
} from 'lucide-react';
import { DESIGN_TOKENS, getDesignTokens } from '../lib/designTokens';

// --- CONTAINER ---
interface NeumorphicProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  darkMode?: boolean;
  inset?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  className?: string;
  id?: string;
  glass?: boolean;
}

export const NeumorphicContainer: React.FC<NeumorphicProps> = ({
  children,
  darkMode = false,
  inset = false,
  rounded = '3xl', // Cards and panels default to 3xl (24px)
  className = '',
  id,
  glass = false,
  ...props
}) => {
  const tokens = getDesignTokens(darkMode);
  const roundedClass = rounded === '3xl' ? tokens.largeRadius : rounded === 'full' ? 'rounded-full' : tokens.smallRadius;

  const shadowClass = glass ? '' : (inset ? tokens.inset : tokens.raised);
  const bgClass = glass ? tokens.glass : tokens.baseBg;

  return (
    <div
      id={id}
      className={`transition-all duration-300 ${bgClass} ${shadowClass} ${roundedClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  darkMode?: boolean;
  active?: boolean;
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  className?: string;
  id: string;
}

export const NeumorphicButton: React.FC<ButtonProps> = ({
  children,
  darkMode = false,
  active = false,
  loading = false,
  loadingText = 'Sending...',
  variant = 'secondary',
  rounded = 'xl', // Small controls default to xl/16px
  className = '',
  disabled,
  id,
  ...props
}) => {
  const tokens = getDesignTokens(darkMode);
  const roundedClass = rounded === '3xl' ? tokens.largeRadius : rounded === 'full' ? 'rounded-full' : tokens.smallRadius;
  const bgClass = tokens.baseBg;
  const isDisabled = disabled || loading;
  
  let themeClasses = '';

  if (variant === 'primary') {
    themeClasses = active || loading
      ? `bg-[#0d9488] text-white ${tokens.pressed}`
      : `bg-[#0d9488] text-white ${tokens.raised} hover:bg-[#0f766e] active:scale-95`;
  } else if (variant === 'danger') {
    themeClasses = active
      ? 'bg-red-600 text-white shadow-[inset_3px_3px_6px_#7f1d1d,_inset_-3px_-3px_6px_#ef4444]'
      : `bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 ${tokens.raised} hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95`;
  } else if (variant === 'ghost') {
    themeClasses = active
      ? `${tokens.accent.classes.text} ${tokens.inset}`
      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100';
  } else {
    themeClasses = active
      ? `${bgClass} ${tokens.accent.classes.text} ${tokens.inset}`
      : `${bgClass} ${tokens.baseText} ${tokens.raised} active:scale-95`;
  }

  const disabledClasses = isDisabled 
    ? 'opacity-55 cursor-not-allowed pointer-events-none shadow-none' 
    : '';

  return (
    <button
      id={id}
      disabled={isDisabled}
      className={`px-4 py-2 font-medium transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer focus:outline-none ${roundedClass} ${themeClasses} ${disabledClasses} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
      {loading ? loadingText : children}
    </button>
  );
};

// --- INPUTS WITH HELPER TEXT & ERROR STATES ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  darkMode?: boolean;
  className?: string;
  id: string;
  error?: string;
  helperText?: string;
}

export const NeumorphicInput: React.FC<InputProps> = ({
  darkMode = false,
  className = '',
  id,
  error,
  helperText,
  ...props
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  
  const shadowClass = error
    ? darkMode
      ? 'shadow-[inset_4px_4px_8px_#450a0a,_inset_-4px_-4px_8px_#262b34]'
      : 'shadow-[inset_4px_4px_8px_#fee2e2,_inset_-4px_-4px_8px_#ffffff]'
    : tokens.inset;

  const borderStateClass = error 
    ? 'ring-2 ring-red-500/30' 
    : `focus:ring-2 ${tokens.accent.classes.ring}`;

  return (
    <div className="w-full space-y-1">
      <input
        id={id}
        className={`w-full px-4 py-3 outline-none transition-all duration-300 ${tokens.smallRadius} ${tokens.baseText} ${bgClass} ${shadowClass} placeholder-gray-400 dark:placeholder-gray-500 ${borderStateClass} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium pl-1 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

// --- TEXTAREA ---
interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  darkMode?: boolean;
  className?: string;
  id: string;
  error?: string;
  helperText?: string;
}

export const NeumorphicTextArea: React.FC<TextAreaProps> = ({
  darkMode = false,
  className = '',
  id,
  error,
  helperText,
  ...props
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const shadowClass = error
    ? darkMode
      ? 'shadow-[inset_4px_4px_8px_#450a0a,_inset_-4px_-4px_8px_#262b34]'
      : 'shadow-[inset_4px_4px_8px_#fee2e2,_inset_-4px_-4px_8px_#ffffff]'
    : tokens.inset;

  const borderStateClass = error 
    ? 'ring-2 ring-red-500/30' 
    : `focus:ring-2 ${tokens.accent.classes.ring}`;

  return (
    <div className="w-full space-y-1">
      <textarea
        id={id}
        className={`w-full px-4 py-3 outline-none transition-all duration-300 ${tokens.smallRadius} ${tokens.baseText} ${bgClass} ${shadowClass} placeholder-gray-400 dark:placeholder-gray-500 ${borderStateClass} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-1 font-medium pl-1 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-xs text-gray-400 dark:text-gray-500 pl-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

// --- SELECT ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  darkMode?: boolean;
  className?: string;
  id: string;
  children: React.ReactNode;
}

export const NeumorphicSelect: React.FC<SelectProps> = ({
  darkMode = false,
  className = '',
  id,
  children,
  ...props
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const shadowClass = tokens.raised;

  return (
    <select
      id={id}
      className={`px-4 py-3 outline-none transition-all duration-300 ${tokens.smallRadius} ${tokens.baseText} cursor-pointer ${bgClass} ${shadowClass} focus:ring-2 ${tokens.accent.classes.ring} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};

// --- CHECKBOX ---
interface CheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  darkMode?: boolean;
  disabled?: boolean;
  className?: string;
}

export const NeumorphicCheckbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  darkMode = false,
  disabled = false,
  className = ''
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const shadowClass = checked ? tokens.inset : tokens.raised;

  return (
    <label 
      className={`flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        disabled={disabled}
      />
      <div 
        className={`w-6 h-6 rounded-[8px] flex items-center justify-center transition-all duration-300 ${bgClass} ${shadowClass} ${checked ? tokens.accent.classes.text : 'text-transparent'}`}
      >
        <Check className="w-4 h-4" strokeWidth={3} />
      </div>
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
    </label>
  );
};

// --- RADIO BUTTON ---
interface RadioProps {
  id: string;
  name: string;
  value: string;
  selectedValue: string;
  onChange: (value: string) => void;
  label?: string;
  darkMode?: boolean;
  disabled?: boolean;
  className?: string;
}

export const NeumorphicRadio: React.FC<RadioProps> = ({
  id,
  name,
  value,
  selectedValue,
  onChange,
  label,
  darkMode = false,
  disabled = false,
  className = ''
}) => {
  const tokens = getDesignTokens(darkMode);
  const isSelected = value === selectedValue;
  const bgClass = tokens.baseBg;
  const shadowClass = isSelected ? tokens.inset : tokens.raised;

  return (
    <label 
      className={`flex items-center gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={isSelected}
        onChange={() => onChange(value)}
        className="sr-only"
        disabled={disabled}
      />
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${bgClass} ${shadowClass}`}
      >
        {isSelected && (
          <div className="w-2.5 h-2.5 rounded-full bg-[#0d9488] animate-ping" style={{ animationDuration: '3s' }} />
        )}
      </div>
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
    </label>
  );
};

// --- TOGGLE SWITCH ---
interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  darkMode?: boolean;
  disabled?: boolean;
  className?: string;
}

export const NeumorphicToggle: React.FC<ToggleProps> = ({
  id,
  checked,
  onChange,
  darkMode = false,
  disabled = false,
  className = ''
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const trackShadow = tokens.inset;
  const thumbShadow = tokens.raised;

  return (
    <label 
      className={`relative inline-flex items-center cursor-pointer select-none ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
        disabled={disabled}
      />
      <div 
        className={`w-14 h-8 rounded-full transition-all duration-300 ${bgClass} ${trackShadow} relative p-1`}
      >
        <div 
          className={`w-6 h-6 rounded-full transition-all duration-300 transform ${
            checked ? 'translate-x-6 bg-[#0d9488]' : 'translate-x-0 bg-gray-400 dark:bg-gray-600'
          } ${thumbShadow}`}
        />
      </div>
    </label>
  );
};

// --- SLIDER WITH VALUE TOOLTIP ---
interface SliderProps {
  id: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  darkMode?: boolean;
  disabled?: boolean;
  className?: string;
}

export const NeumorphicSlider: React.FC<SliderProps> = ({
  id,
  min,
  max,
  value,
  onChange,
  darkMode = false,
  disabled = false,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;
  
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const trackShadow = tokens.inset;
  const thumbShadow = tokens.raised;

  return (
    <div className={`relative w-full pt-6 pb-2 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {/* Tooltip */}
      {showTooltip && (
        <div 
          className="absolute -top-2 px-2 py-1 text-xs font-bold text-white bg-[#0d9488] rounded-[8px] transform -translate-x-1/2 shadow-md transition-all z-20"
          style={{ left: `${percent}%` }}
        >
          {value}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0d9488]" />
        </div>
      )}
      
      {/* Track */}
      <div 
        className={`w-full h-3 rounded-full relative transition-all duration-300 ${bgClass} ${trackShadow}`}
      >
        {/* Progress Fill */}
        <div 
          className="absolute left-0 top-0 h-full rounded-full bg-[#0d9488]/30"
          style={{ width: `${percent}%` }}
        />
        
        {/* Input Overlaid */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={disabled}
        />

        {/* Real Thumb visual representation */}
        <div 
          className={`absolute top-1/2 w-6 h-6 rounded-full bg-[#0d9488] border-2 border-white dark:border-[#1a1d24] transition-all duration-150 transform -translate-y-1/2 -translate-x-1/2 pointer-events-none ${thumbShadow}`}
          style={{ left: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// --- TABS ---
interface TabOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  id: string;
  options: TabOption[];
  activeTab: string;
  onChange: (tabId: string) => void;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicTabs: React.FC<TabsProps> = ({
  id,
  options,
  activeTab,
  onChange,
  darkMode = false,
  className = ''
}) => {
  const tokens = getDesignTokens(darkMode);
  const bgClass = tokens.baseBg;
  const trackShadow = tokens.inset;
  const isFullWidth = className.includes('w-full');
  const isTextXs = className.includes('text-xs');

  return (
    <div 
      id={id}
      className={`relative p-1.5 flex gap-1 items-center ${tokens.smallRadius} overflow-x-auto ${bgClass} ${trackShadow} ${className}`}
    >
      {options.map((option) => {
        const isActive = option.id === activeTab;
        const activeShadow = tokens.raised;

        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 font-semibold rounded-[12px] whitespace-nowrap focus:outline-none cursor-pointer z-10 transition-colors duration-200 ${
              isFullWidth ? 'flex-1' : ''
            } ${
              isTextXs ? 'text-xs' : 'text-sm'
            } ${
              isActive 
                ? `${tokens.accent.classes.text}` 
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            {option.icon}
            <span className="relative z-10">{option.label}</span>
            {isActive && (
              <motion.div
                layoutId={`${id}-active-pill`}
                className={`absolute inset-0 rounded-[12px] ${bgClass} ${activeShadow} -z-10`}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

// --- BREADCRUMBS ---
interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicBreadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  darkMode = false,
  className = ''
}) => {
  return (
    <nav className={`flex items-center gap-2 text-sm font-medium ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <button
              onClick={item.onClick}
              disabled={isLast || !item.onClick}
              className={`transition-colors cursor-pointer ${
                isLast 
                  ? 'text-gray-800 dark:text-gray-200 cursor-default' 
                  : 'text-gray-400 hover:text-[#0d9488] dark:text-gray-500 dark:hover:text-[#0d9488]'
              }`}
            >
              {item.label}
            </button>
            {!isLast && <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// --- MULTI-STEP PROGRESS INDICATOR (NUMBERED) ---
interface ProgressStepsProps {
  steps: string[];
  currentStep: number; // 1-indexed
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicProgressSteps: React.FC<ProgressStepsProps> = ({
  steps,
  currentStep,
  darkMode = false,
  className = ''
}) => {
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  return (
    <div className={`flex items-center justify-between w-full max-w-xl mx-auto ${className}`}>
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        
        const outerShadow = isActive
          ? darkMode
            ? 'shadow-[inset_3px_3px_6px_#0e1014,_inset_-3px_-3px_6px_#262b34]'
            : 'shadow-[inset_3px_3px_6px_#b5c1d4,_inset_-3px_-3px_6px_#ffffff]'
          : darkMode
            ? 'shadow-[4px_4px_8px_#0e1014,_-4px_-4px_8px_#262b34]'
            : 'shadow-[4px_4px_8px_#b5c1d4,_-4px_-4px_8px_#ffffff]';

        return (
          <React.Fragment key={index}>
            {/* Step circle */}
            <div className="flex flex-col items-center gap-2 relative">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${bgClass} ${outerShadow} ${
                  isCompleted 
                    ? 'bg-[#0d9488] text-white shadow-none' 
                    : isActive 
                      ? 'text-[#0d9488] border-2 border-[#0d9488]' 
                      : 'text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" strokeWidth={3} /> : stepNum}
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 absolute top-12 whitespace-nowrap">
                {step}
              </span>
            </div>
            
            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-1.5 mx-4 rounded-full bg-gray-300 dark:bg-gray-800 relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-[#0d9488] transition-all duration-500"
                  style={{ width: isCompleted ? '100%' : '0%' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// --- PAGINATION ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicPagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  darkMode = false,
  className = ''
}) => {
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = darkMode
    ? 'shadow-[4px_4px_8px_#0e1014,_-4px_-4px_8px_#262b34]'
    : 'shadow-[4px_4px_8px_#b5c1d4,_-4px_-4px_8px_#ffffff]';

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={`flex items-center gap-2.5 justify-center ${className}`}>
      {/* Prev */}
      <button
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer ${bgClass} ${shadowClass} disabled:opacity-40 disabled:pointer-events-none active:scale-95`}
      >
        <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>

      {/* Pages */}
      {pages.map((p) => {
        const isActive = p === currentPage;
        const activeShadow = darkMode
          ? 'shadow-[inset_3px_3px_6px_#0e1014,_inset_-3px_-3px_6px_#262b34]'
          : 'shadow-[inset_3px_3px_6px_#b5c1d4,_inset_-3px_-3px_6px_#ffffff]';

        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-10 h-10 rounded-[12px] font-bold text-sm transition-all duration-300 focus:outline-none cursor-pointer flex items-center justify-center ${
              isActive 
                ? `${bgClass} text-[#0d9488] ${activeShadow}` 
                : `${bgClass} text-gray-500 dark:text-gray-400 ${shadowClass} active:scale-95`
            }`}
          >
            {p}
          </button>
        );
      })}

      {/* Next */}
      <button
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`w-10 h-10 rounded-[12px] flex items-center justify-center transition-all duration-300 focus:outline-none cursor-pointer ${bgClass} ${shadowClass} disabled:opacity-40 disabled:pointer-events-none active:scale-95`}
      >
        <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>
    </div>
  );
};

// --- BADGE ---
interface BadgeProps {
  children: React.ReactNode;
  darkMode?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
  className?: string;
  inset?: boolean;
}

export const NeumorphicBadge: React.FC<BadgeProps> = ({
  children,
  darkMode = false,
  variant = 'secondary',
  className = '',
  inset = true
}) => {
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = inset
    ? darkMode
      ? 'shadow-[inset_2px_2px_4px_#0e1014,_inset_-2px_-2px_4px_#262b34]'
      : 'shadow-[inset_2px_2px_4px_#b5c1d4,_inset_-2px_-2px_4px_#ffffff]'
    : darkMode
      ? 'shadow-[2px_2px_4px_#0e1014,_-2px_-2px_4px_#262b34]'
      : 'shadow-[2px_2px_4px_#b5c1d4,_-2px_-2px_4px_#ffffff]';

  let colorClass = 'text-gray-600 dark:text-gray-400';
  if (variant === 'primary') colorClass = 'text-[#0d9488] font-bold';
  else if (variant === 'danger') colorClass = 'text-red-600 dark:text-red-400 font-bold';
  else if (variant === 'warning') colorClass = 'text-amber-600 dark:text-amber-400 font-bold';
  else if (variant === 'success') colorClass = 'text-emerald-600 dark:text-emerald-400 font-bold';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold select-none ${bgClass} ${shadowClass} ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
};

// --- AVATAR GROUP ---
interface AvatarGroupProps {
  images: string[];
  names?: string[];
  limit?: number;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicAvatarGroup: React.FC<AvatarGroupProps> = ({
  images,
  names = [],
  limit = 3,
  darkMode = false,
  className = ''
}) => {
  const visibleImages = images.slice(0, limit);
  const excess = images.length - limit;
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = darkMode
    ? 'shadow-[2px_2px_4px_#0e1014,_-2px_-2px_4px_#262b34]'
    : 'shadow-[2px_2px_4px_#b5c1d4,_-2px_-2px_4px_#ffffff]';

  return (
    <div className={`flex items-center -space-x-3 select-none ${className}`}>
      {visibleImages.map((src, idx) => (
        <img
          key={idx}
          src={src}
          alt={names[idx] || 'User'}
          referrerPolicy="no-referrer"
          className={`w-9 h-9 rounded-full border-2 border-white dark:border-[#1a1d24] transition-all object-cover hover:translate-y-[-4px] hover:z-30 relative ${shadowClass}`}
        />
      ))}
      {excess > 0 && (
        <div 
          className={`w-9 h-9 rounded-full border-2 border-white dark:border-[#1a1d24] flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400 z-10 ${bgClass} ${shadowClass}`}
        >
          +{excess}
        </div>
      )}
    </div>
  );
};

// --- TOOLTIP ---
interface TooltipProps {
  content: string;
  children: React.ReactElement;
  darkMode?: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const NeumorphicTooltip: React.FC<TooltipProps> = ({
  content,
  children,
  darkMode = false,
  position = 'top',
  className = ''
}) => {
  const [active, setActive] = useState(false);
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = darkMode
    ? 'shadow-[4px_4px_8px_#0e1014,_-4px_-4px_8px_#262b34]'
    : 'shadow-[4px_4px_8px_#b5c1d4,_-4px_-4px_8px_#ffffff]';

  let posClasses = '';
  let arrowClasses = '';

  if (position === 'top') {
    posClasses = 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    arrowClasses = 'top-full left-1/2 transform -translate-x-1/2 -mt-1 border-t-white dark:border-t-[#1a1d24]';
  } else if (position === 'bottom') {
    posClasses = 'top-full left-1/2 transform -translate-x-1/2 mt-2';
    arrowClasses = 'bottom-full left-1/2 transform -translate-x-1/2 -mb-1 border-b-white dark:border-b-[#1a1d24]';
  } else if (position === 'left') {
    posClasses = 'right-full top-1/2 transform -translate-y-1/2 mr-2';
    arrowClasses = 'left-full top-1/2 transform -translate-y-1/2 -ml-1 border-l-white dark:border-l-[#1a1d24]';
  } else {
    posClasses = 'left-full top-1/2 transform -translate-y-1/2 ml-2';
    arrowClasses = 'right-full top-1/2 transform -translate-y-1/2 -mr-1 border-r-white dark:border-r-[#1a1d24]';
  }

  return (
    <div 
      className="relative inline-block w-fit"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
    >
      {children}
      {active && (
        <div 
          className={`absolute z-50 px-3 py-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 border border-white/20 dark:border-[#1a1d24]/20 rounded-[8px] whitespace-nowrap pointer-events-none transition-opacity duration-300 ${bgClass} ${shadowClass} ${posClasses} ${className}`}
        >
          {content}
          <div className={`absolute border-4 border-transparent ${arrowClasses}`} />
        </div>
      )}
    </div>
  );
};

// --- TABLE COLUMN HEADER SORTABLE ---
interface TableHeaderProps {
  label: string;
  sortField?: string;
  activeSortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicTableHeader: React.FC<TableHeaderProps> = ({
  label,
  sortField,
  activeSortField,
  sortDirection,
  onSort,
  darkMode = false,
  className = ''
}) => {
  const isSorted = sortField && sortField === activeSortField;
  
  return (
    <th 
      className={`px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 select-none uppercase tracking-wider font-mono ${
        sortField ? 'cursor-pointer hover:text-[#0d9488]' : ''
      } ${className}`}
      onClick={() => sortField && onSort && onSort(sortField)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortField && (
          <ArrowUpDown className={`w-3.5 h-3.5 transition-colors ${
            isSorted ? 'text-[#0d9488]' : 'text-gray-400'
          }`} />
        )}
      </div>
    </th>
  );
};

// --- CONFIRMATION DIALOG / MODAL ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  darkMode?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  variant?: 'info' | 'danger';
  confirmLoading?: boolean;
  id: string;
}

export const NeumorphicModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  darkMode = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'info',
  confirmLoading = false,
  id
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/45 dark:bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Box container */}
      <NeumorphicContainer
        darkMode={darkMode}
        glass={true}
        className="relative w-full max-w-md p-6 overflow-hidden max-h-[90vh] flex flex-col z-10"
        rounded="3xl"
        id={id}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)]">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {variant === 'danger' && <AlertCircle className="w-5 h-5 text-red-500" />}
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto py-5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {children}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
          <NeumorphicButton
            id={`${id}-cancel`}
            darkMode={darkMode}
            onClick={onClose}
            disabled={confirmLoading}
            className="py-2 px-4.5 text-sm"
          >
            {cancelLabel}
          </NeumorphicButton>
          {onConfirm && (
            <NeumorphicButton
              id={`${id}-confirm`}
              darkMode={darkMode}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              loading={confirmLoading}
              onClick={async () => {
                await onConfirm();
                onClose();
              }}
              className="py-2 px-5 text-sm"
            >
              {confirmLabel}
            </NeumorphicButton>
          )}
        </div>
      </NeumorphicContainer>
    </div>
  );
};

// --- ALERT BANNERS ---
interface BannerProps {
  title?: string;
  message: string;
  variant?: 'info' | 'warning' | 'error' | 'success';
  darkMode?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const NeumorphicBanner: React.FC<BannerProps> = ({
  title,
  message,
  variant = 'info',
  darkMode = false,
  onDismiss,
  className = ''
}) => {
  let accentColor = 'text-indigo-500';
  let bannerBgClass = 'bg-[#1a1d24]/5 border border-indigo-500/20';
  
  if (variant === 'warning') {
    accentColor = 'text-amber-500';
    bannerBgClass = 'bg-amber-500/5 border border-amber-500/20';
  } else if (variant === 'error') {
    accentColor = 'text-red-500';
    bannerBgClass = 'bg-red-500/5 border border-red-500/20';
  } else if (variant === 'success') {
    accentColor = 'text-emerald-500';
    bannerBgClass = 'bg-emerald-500/5 border border-emerald-500/20';
  }

  return (
    <NeumorphicContainer
      darkMode={darkMode}
      className={`p-4 relative overflow-hidden flex gap-3.5 ${bannerBgClass} ${className}`}
      rounded="2xl"
    >
      <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${accentColor}`} />
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-bold text-sm text-gray-900 dark:text-white">{title}</h5>}
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">{message}</p>
      </div>
      {onDismiss && (
        <button 
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </NeumorphicContainer>
  );
};

// --- PROGRESS BAR (LINEAR) ---
interface ProgressBarProps {
  value: number; // 0 to 100
  darkMode?: boolean;
  className?: string;
  label?: string;
  showValueText?: boolean;
}

export const NeumorphicProgressBar: React.FC<ProgressBarProps> = ({
  value,
  darkMode = false,
  className = '',
  label,
  showValueText = false
}) => {
  const percent = Math.min(100, Math.max(0, value));
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const trackShadow = darkMode
    ? 'shadow-[inset_2px_2px_4px_#0e1014,_inset_-2px_-2px_4px_#262b34]'
    : 'shadow-[inset_2px_2px_4px_#b5c1d4,_inset_-2px_-2px_4px_#ffffff]';

  return (
    <div className={`w-full space-y-1 ${className}`}>
      {(label || showValueText) && (
        <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
          {label && <span>{label}</span>}
          {showValueText && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div 
        className={`w-full h-3 rounded-full transition-all duration-300 ${bgClass} ${trackShadow} overflow-hidden`}
      >
        <div 
          className="h-full bg-[#0d9488] rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// --- SKELETON LOADING ROWS ---
interface SkeletonProps {
  rows?: number;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicSkeleton: React.FC<SkeletonProps> = ({
  rows = 3,
  darkMode = false,
  className = ''
}) => {
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = darkMode
    ? 'shadow-[2px_2px_4px_#0e1014,_-2px_-2px_4px_#262b34]'
    : 'shadow-[2px_2px_4px_#b5c1d4,_-2px_-2px_4px_#ffffff]';

  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className={`p-4 rounded-2xl flex items-center gap-4 animate-pulse ${bgClass} ${shadowClass}`}>
          {/* Avatar circle */}
          <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-800 flex-shrink-0" />
          
          {/* Text block */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-800 rounded-md w-1/3" />
            <div className="h-3 bg-gray-300 dark:bg-gray-800 rounded-md w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
};

// --- EMPTY STATE WITH CTA ---
interface EmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  icon?: React.ReactNode;
  darkMode?: boolean;
  className?: string;
}

export const NeumorphicEmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  ctaLabel,
  onCtaClick,
  icon,
  darkMode = false,
  className = ''
}) => {
  return (
    <NeumorphicContainer
      darkMode={darkMode}
      className={`p-10 text-center flex flex-col items-center justify-center space-y-6 ${className}`}
      rounded="3xl"
    >
      <div className="text-gray-400 dark:text-gray-500 animate-pulse">
        {icon || <Inbox className="w-16 h-16" strokeWidth={1.5} />}
      </div>
      
      <div className="space-y-2.5 max-w-sm mx-auto">
        <h4 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
      </div>

      {ctaLabel && onCtaClick && (
        <NeumorphicButton
          id="empty-state-cta-btn"
          darkMode={darkMode}
          variant="primary"
          onClick={onCtaClick}
          className="py-2.5 px-6 text-sm"
        >
          {ctaLabel}
        </NeumorphicButton>
      )}
    </NeumorphicContainer>
  );
};

// --- NEUMORPHIC CARD ---
interface CardProps {
  imageSrc?: string;
  title: string;
  description: string;
  ctaText?: string;
  onCtaClick?: () => void;
  darkMode?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const NeumorphicCard: React.FC<CardProps> = ({
  imageSrc,
  title,
  description,
  ctaText,
  onCtaClick,
  darkMode = false,
  className = '',
  children
}) => {
  return (
    <NeumorphicContainer
      darkMode={darkMode}
      className={`overflow-hidden p-5 flex flex-col justify-between h-full ${className}`}
      rounded="3xl"
    >
      <div className="space-y-4">
        {imageSrc && (
          <div className="relative aspect-video rounded-2xl overflow-hidden shadow-inner select-none bg-gray-300 dark:bg-gray-800">
            <img 
              src={imageSrc} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
        <div className="space-y-2">
          <h4 className="font-bold text-gray-900 dark:text-white text-base leading-snug">{title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">{description}</p>
        </div>
        {children}
      </div>
      {ctaText && onCtaClick && (
        <NeumorphicButton
          id={`card-cta-${title.toLowerCase().replace(/\s+/g, '-')}`}
          darkMode={darkMode}
          variant="primary"
          onClick={onCtaClick}
          className="mt-5 w-full py-2.5 text-sm"
        >
          {ctaText}
        </NeumorphicButton>
      )}
    </NeumorphicContainer>
  );
};

// --- NEUMORPHIC ROW ---
interface RowProps {
  icon?: React.ReactNode;
  avatarSrc?: string;
  title: string;
  description?: string;
  darkMode?: boolean;
  className?: string;
  onClick?: () => void;
  actions?: React.ReactNode;
  chevron?: boolean;
}

export const NeumorphicRow: React.FC<RowProps> = ({
  icon,
  avatarSrc,
  title,
  description,
  darkMode = false,
  className = '',
  onClick,
  actions,
  chevron = false
}) => {
  const bgClass = darkMode ? 'bg-[#1a1d24]' : 'bg-[#e6ebf2]';
  const shadowClass = darkMode
    ? 'shadow-[3px_3px_6px_#0e1014,_-3px_-3px_6px_#262b34]'
    : 'shadow-[3px_3px_6px_#b5c1d4,_-3px_-3px_6px_#ffffff]';

  return (
    <div 
      className={`p-4 flex items-center justify-between gap-4 transition-all duration-300 rounded-2xl ${bgClass} ${shadowClass} ${
        onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {avatarSrc ? (
          <img 
            src={avatarSrc} 
            alt={title} 
            className="w-10 h-10 rounded-full object-cover shadow-inner flex-shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : icon ? (
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#0d9488] flex-shrink-0 shadow-inner bg-black/5 dark:bg-white/5">
            {icon}
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <h5 className="font-bold text-sm text-gray-900 dark:text-white truncate">{title}</h5>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{description}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {chevron && <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />}
      </div>
    </div>
  );
};

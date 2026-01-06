'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/hooks/useLanguage';

interface DateRange {
    startDate: string;
    endDate: string;
}

interface DateRangePickerProps {
    onChange: (range: DateRange) => void;
    initialRange?: DateRange;
}

export default function DateRangePicker({ onChange, initialRange }: DateRangePickerProps) {
    const { t, language } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    // Define presets inside component to use translations
    const PRESETS = [
        {
            label: t('today') || 'Today',
            getValue: () => {
                const today = new Date().toLocaleDateString('en-CA');
                return { startDate: today, endDate: today };
            }
        },
        {
            label: t('last_7_days') || 'Last 7 Days',
            getValue: () => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 7);
                return { startDate: start.toLocaleDateString('en-CA'), endDate: end.toLocaleDateString('en-CA') };
            }
        },
        {
            label: t('this_week') || 'This Week',
            getValue: () => {
                const now = new Date();
                const day = now.getDay(); // 0 is Sunday
                // Adjust for Monday start if needed, but assuming standard Sunday start logic for now or simple diff
                // Basic logic: start of week (Sunday or Monday)
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
                const start = new Date(now.setDate(diff));
                const end = new Date();
                return { startDate: start.toLocaleDateString('en-CA'), endDate: end.toLocaleDateString('en-CA') };
            }
        },
        {
            label: t('this_month') || 'This Month',
            getValue: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                return { startDate: start.toLocaleDateString('en-CA'), endDate: now.toLocaleDateString('en-CA') };
            }
        },
        {
            label: t('last_30_days') || 'Last 30 Days',
            getValue: () => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - 30);
                return { startDate: start.toLocaleDateString('en-CA'), endDate: end.toLocaleDateString('en-CA') };
            }
        },
        {
            label: t('this_year') || 'This Year',
            getValue: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                return { startDate: start.toLocaleDateString('en-CA'), endDate: now.toLocaleDateString('en-CA') };
            }
        },
        {
            label: t('all_times') || 'All Time',
            getValue: () => {
                return { startDate: '2020-01-01', endDate: new Date().toLocaleDateString('en-CA') };
            }
        }
    ];

    const [range, setRange] = useState<DateRange>(initialRange || PRESETS[3].getValue()); // Default: Bu Ay
    const [activePreset, setActivePreset] = useState<string>(t('this_month') || 'This Month');
    const [isDateInputActive, setIsDateInputActive] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update active preset label when language changes
    useEffect(() => {
        // Force reset to 'This Month' translated if default
        setActivePreset(t('this_month') || 'This Month');
    }, [language, t]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Don't close if date input is being used
            if (isDateInputActive) {
                return;
            }

            // Don't close if clicking inside our dropdown
            if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
                return;
            }

            setIsOpen(false);
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDateInputActive]);

    // Handler for date input focus
    const handleDateInputFocus = () => {
        setIsDateInputActive(true);
    };

    // Handler for date input blur - delay to allow click events to process
    const handleDateInputBlur = () => {
        setTimeout(() => {
            setIsDateInputActive(false);
        }, 300);
    };

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        const newRange = preset.getValue();
        setRange(newRange);
        setActivePreset(preset.label);
        onChange(newRange);
        setIsOpen(false);
    };

    const handleCustomChange = (field: 'startDate' | 'endDate', value: string) => {
        const newRange = { ...range, [field]: value };
        setRange(newRange);
        setActivePreset(t('custom_range') || 'Custom');
        // Don't call onChange here - wait for Apply button
    };

    const formatDisplayDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>
                    {formatDisplayDate(range.startDate)} - {formatDisplayDate(range.endDate)}
                </span>
                <span className="text-xs text-muted-foreground border-l border-border pl-3">
                    {activePreset}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-[400px] rounded-xl border border-border bg-card shadow-xl z-50">
                    <div className="flex">
                        {/* Presets */}
                        <div className="w-1/2 border-r border-border p-3">
                            <p className="text-xs text-muted-foreground mb-2 px-2">{t('quick_select') || 'Quick Select'}</p>
                            <div className="space-y-1">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => handlePresetClick(preset)}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                                            ${activePreset === preset.label
                                                ? 'bg-blue-600 text-white'
                                                : 'text-muted-foreground hover:bg-muted'}`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Date Inputs */}
                        <div className="w-1/2 p-4">
                            <p className="text-xs text-muted-foreground mb-3">{t('custom_range') || 'Custom Range'}</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">{t('start_date') || 'Start'}</label>
                                    <input
                                        type="date"
                                        value={range.startDate}
                                        onChange={(e) => handleCustomChange('startDate', e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onFocus={handleDateInputFocus}
                                        onBlur={handleDateInputBlur}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-muted-foreground mb-1">{t('end_date') || 'End'}</label>
                                    <input
                                        type="date"
                                        value={range.endDate}
                                        onChange={(e) => handleCustomChange('endDate', e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onFocus={handleDateInputFocus}
                                        onBlur={handleDateInputBlur}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    onChange(range);
                                    setIsOpen(false);
                                }}
                                className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                            >
                                {t('apply') || 'Apply'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

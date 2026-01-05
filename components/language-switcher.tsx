'use client';

import { useLanguage } from '@/components/language-provider';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => setLanguage(language === 'tr' ? 'en' : 'tr')}
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={language === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'}
            >
                <Globe className="h-5 w-5 mr-1" />
                <span className="text-sm font-medium uppercase">{language}</span>
            </button>
        </div>
    );
}

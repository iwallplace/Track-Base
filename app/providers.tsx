'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { LanguageProvider } from '@/components/language-provider';
import { ToastProvider } from '@/components/toast';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchInterval={5 * 60}>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <LanguageProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </LanguageProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}

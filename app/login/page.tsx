'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await signIn('credentials', {
            username,
            password,
            redirect: false,
        });

        if (res?.error) {
            setError('Giriş bilgileri hatalı.');
        } else {
            router.push('/dashboard');
        }
    };

    return (
        <div className="flex min-h-screen w-full relative">
            {/* Left Side - Image/Brand */}
            <div className="hidden lg:relative lg:flex lg:w-1/2 flex-col justify-end bg-gray-900 text-white">
                <div className="absolute inset-0">
                    <img
                        src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                        alt="Warehouse"
                        className="h-full w-full object-cover opacity-40"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
                </div>



                {/* Branding Content - Bottom */}
                <div className="relative z-10 p-12">
                    <div className="mb-2 flex items-center gap-2 font-bold text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500">
                            <span className="text-white">P</span>
                        </div>
                        Project Track Base
                    </div>
                    <h1 className="mt-4 text-4xl font-bold leading-tight">
                        Lojistik süreçlerinizi uçtan<br />uca yönetin.
                    </h1>
                    <p className="mt-4 text-lg text-gray-300">
                        Paketleme, etiketleme ve sevkiyat süreçlerini tek bir platformdan izleyin.
                        Verimliliği artırın, hataları azaltın.
                    </p>
                    <div className="mt-8 text-sm text-gray-400">
                        <span>© 2026 Project Track Base</span>
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2 relative transition-colors">
                {/* Footer Signature */}
                <div className="absolute bottom-4 w-full text-center">
                    <p className="text-xs text-muted-foreground font-medium">
                        Architected by <Link href="https://www.linkedin.com/in/ahmetmersin/" target="_blank" className="text-muted-foreground font-bold hover:text-blue-500 transition-colors cursor-default">Ahmet Mersin</Link>
                    </p>
                </div>
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">Giriş Yap</h2>
                        <p className="mt-2 text-muted-foreground">
                            Paketleme Takip Sistemi'ne erişmek için bilgilerinizi girin.
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="rounded bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Kullanıcı Adı veya E-posta
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" suppressHydrationWarning />
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="block w-full rounded-lg border border-input bg-background py-3 pl-10 text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                                        placeholder="ornek@sirket.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">
                                    Şifre
                                </label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" suppressHydrationWarning />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full rounded-lg border border-input bg-background py-3 pl-10 text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm transition-colors"
                                        placeholder="••••••••"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="text-muted-foreground hover:text-foreground focus:outline-none"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" suppressHydrationWarning />
                                            ) : (
                                                <Eye className="h-5 w-5" suppressHydrationWarning />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions removed - simplified login */}

                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-lg border border-transparent bg-blue-600 py-3 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
                        >
                            Giriş Yap
                        </button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="bg-background px-2 text-muted-foreground transition-colors">SİSTEM DESTEK</span>
                            </div>
                        </div>

                        <p className="text-center text-sm text-muted-foreground">
                            Henüz bir hesabınız yok mu? <a href="mailto:ahmet.mersin@se.com?subject=Project Track Base - Hesap Talebi" className="font-medium text-blue-500 hover:text-blue-400">Yönetici ile iletişime geçin</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}

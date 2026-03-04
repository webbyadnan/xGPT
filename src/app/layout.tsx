import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: 'xGPT — Your AI Assistant',
    description:
        'xGPT is a powerful ChatGPT-like AI assistant powered by Groq. Chat, generate images, and explore the future of AI.',
    keywords: ['AI', 'chatbot', 'GPT', 'image generation', 'Groq'],
    openGraph: {
        title: 'xGPT — Your AI Assistant',
        description: 'Powerful AI chat & image generation, faster than ever.',
        type: 'website',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className={inter.variable}>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}

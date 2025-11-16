import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/globals.css';
import { ApolloWrapper } from '@/lib/apollo-client';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Team Task Management',
  description: 'Task management app using REST + GraphQL microservices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ApolloWrapper>{children}</ApolloWrapper>
      </body>
    </html>
  );
}

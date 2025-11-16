'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

// === MODIFIKASI DI SINI ===
// Modifikasi authLink untuk mengambil token dari localStorage
const authLink = setContext((_, { headers }) => {
  // Ambil token dari local storage (sama seperti di api.ts)
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  
  return {
    headers: {
      ...headers,
      // Tambahkan header authorization jika token ada
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});
// =========================

const client = new ApolloClient({
  link: authLink.concat(httpLink), // Pastikan authLink dijalankan sebelum httpLink
  cache: new InMemoryCache(),
  connectToDevTools: true,
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

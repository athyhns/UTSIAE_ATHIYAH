// frontend-app/src/app/page.tsx (Kode Lengkap)

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { authApi, userApi } from '@/lib/api'; 

// === Query & Mutation GraphQL (Posts/Comments) ===
const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      author
      createdAt
      comments { id, content, author }
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!, $author: String!) {
    createPost(title: $title, content: $content, author: $author) {
      id, title, content, author
    }
  }
`;

const CREATE_COMMENT = gql`
  mutation CreateComment($postId: ID!, $content: String!, $author: String!) {
    createComment(postId: $postId, content: $content, author: $author) {
      id, content, author, postId
    }
  }
`;

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;
// ======================================

/**
 * Komponen Utama
 */
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSuccess = (token: string) => {
    localStorage.setItem('authToken', token);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsLoggedIn(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      {!isLoggedIn ? (
        <AuthComponent onLoginSuccess={handleLoginSuccess} />
      ) : (
        <DashboardComponent onLogout={handleLogout} />
      )}
    </div>
  );
}

/**
 * Komponen Autentikasi (LENGKAP)
 */
function AuthComponent({ onLoginSuccess }: { onLoginSuccess: (token: string) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', age: 18 });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authApi.login({
        email: formData.email,
        password: formData.password,
      });
      onLoginSuccess(response.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        age: Number(formData.age),
      });
      setIsRegistering(false);
      setError('Registration successful! Please log in.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded shadow">
      <h2 className="text-2xl font-bold text-center mb-6">
        {isRegistering ? 'Register' : 'Login'}
      </h2>
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      
      <form onSubmit={isRegistering ? handleRegister : handleLogin}>
        {isRegistering && (
          <>
            <input type="text" name="name" placeholder="Name" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
            <input type="number" name="age" placeholder="Age" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
          </>
        )}
        <input type="email" name="email" placeholder="Email" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
        <input type="password" name="password" placeholder="Password" onChange={handleChange} className="border rounded-md px-3 py-2 w-full mb-4" required />
        
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md w-full hover:bg-blue-600">
          {isRegistering ? 'Register' : 'Login'}
        </button>
      </form>

      <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-center w-full mt-4 text-blue-500">
        {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}


// FUNGSI HELPER: Decode Token
function getDecodedToken(): { name: string, role: string } | null {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        name: payload.name || 'User',
        role: payload.role || 'user'
      };
    } catch (e) {
      return null;
    }
}

/**
 * Komponen Dashboard (Posts/Comments) - LENGKAP
 */
function DashboardComponent({ onLogout }: { onLogout: () => void }) {
  const { data: postsData, loading: postsLoading, error: postsError, refetch: refetchPosts } = useQuery(GET_POSTS);
  
  const [createPost] = useMutation(CREATE_POST, { refetchQueries: [GET_POSTS] });
  const [createComment] = useMutation(CREATE_COMMENT, { refetchQueries: [GET_POSTS] });
  const [deletePost] = useMutation(DELETE_POST, { refetchQueries: [GET_POSTS] }); 

  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const [userData, setUserData] = useState<{ name: string, role: string } | null>(null);
  useEffect(() => {
    setUserData(getDecodedToken());
  }, []);
  const userName = userData?.name || 'User';
  const userRole = userData?.role || 'user';

  const handlePostChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewPost({ ...newPost, [e.target.name]: e.target.value });
  };

  const handleCommentInputChange = (postId: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: value }));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPost({
        variables: {
          title: newPost.title,
          content: newPost.content,
          author: userName, 
        },
      });
      setNewPost({ title: '', content: '' }); 
    } catch (err) {
      console.error('Failed to create post:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Anda yakin ingin menghapus post ini?')) {
      try {
        await deletePost({ variables: { id: postId } });
      } catch (err: any) {
        alert('Gagal menghapus post: ' + err.message);
      }
    }
  };

  const handleCreateComment = async (postId: string) => {
    const content = (commentInputs[postId] || '').trim();
    if (!content) return;

    try {
      await createComment({
        variables: {
          postId,
          content,
          author: userName,
        },
      });
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      alert('Gagal menambahkan komentar: ' + (err.message || 'Unknown error'));
    }
  };

  if (postsLoading) return <p>Loading dashboard...</p>;
  if (postsError) {
    console.error('GraphQL Error:', postsError.message);
    onLogout();
    return <p>Error loading data. Logging out...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Selamat Datang, {userName}!</h1>
          <p className="text-xl text-gray-600">Peran Anda: <span className="font-bold">{userRole}</span></p>
        </div>
        <button onClick={onLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
          Logout
        </button>
      </div>

      {/* Form Create Post (Formulir yang hilang) */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Create New Post</h2>
        <form onSubmit={handleCreatePost}>
          <div className="grid grid-cols-1 gap-4">
            <input type="text" name="title" placeholder="Post Title" value={newPost.title} onChange={handlePostChange} className="border rounded-md px-3 py-2" required />
            <textarea name="content" placeholder="What's on your mind?" value={newPost.content} onChange={handlePostChange} className="border rounded-md px-3 py-2 h-24" required />
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
              Submit Post
            </button>
          </div>
        </form>
      </div>

      {/* === PANEL ADMIN === */}
      {userRole === 'admin' && (
        <AdminPanel />
      )}
      {/* ========================= */}

      {/* Daftar Posts (List yang hilang) */}
      <div className="space-y-8">
        {postsData?.posts.map((post: any) => (
          <div key={post.id} className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{post.title}</h2>
            <p className="text-sm text-gray-500 mb-4">by {post.author} on {new Date(post.createdAt).toLocaleDateString()}</p>
            <p className="text-gray-700">{post.content}</p>
            
            {/* Tombol Hapus Post (Hanya untuk Admin atau Pemilik) */}
            {(userRole === 'admin' || post.author === userName) && (
              <button 
                onClick={() => handleDeletePost(post.id)}
                className="mt-4 bg-red-100 text-red-700 px-3 py-1 rounded text-sm font-medium hover:bg-red-200"
              >
                Hapus Post
              </button>
            )}
            
            {/* Bagian Komentar */}
            <div className="mt-6 border-t pt-4">
              <h4 className="text-lg font-semibold mb-2">Comments ({post.comments.length})</h4>
              <div className="space-y-2">
                {post.comments.map((comment: any) => (
                  <div key={comment.id} className="text-sm bg-gray-50 p-2 rounded">
                    <strong>{comment.author}:</strong> {comment.content}
                  </div>
                ))}
                {post.comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
              </div>
              <div className="mt-4 space-y-2">
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Tulis komentar..."
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                />
                <button
                  onClick={() => handleCreateComment(post.id)}
                  disabled={!(commentInputs[post.id] || '').trim()}
                  className="bg-green-500 text-white px-4 py-2 rounded-md text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tambah Komentar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// === KOMPONEN PANEL ADMIN ===
function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.getUsers(); 
      setUsers(response.data);
    } catch (error) {
      console.error("Gagal mengambil daftar user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('PERINGATAN: Anda yakin ingin menghapus user ini?')) {
      try {
        await userApi.deleteUser(userId); 
        fetchUsers(); 
      } catch (err: any) {
        alert('Gagal menghapus user: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await userApi.changeUserRole(userId, newRole); 
      fetchUsers(); 
    } catch (err: any) {
      alert('Gagal mengubah role: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <p>Memuat panel admin...</p>;

  return (
    <div className="bg-yellow-50 shadow rounded-lg p-6 mb-8 border border-yellow-200">
      <h2 className="text-2xl font-bold text-yellow-900 mb-4">Panel Admin: Manajemen User</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-yellow-200">
          <thead className="bg-yellow-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase">Nama</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-yellow-800 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{user.role}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.role === 'user' ? (
                    <button onClick={() => handleChangeRole(user.id, 'admin')} className="text-green-600 hover:text-green-900 mr-4">
                      Jadikan Admin
                    </button>
                  ) : (
                    <button onClick={() => handleChangeRole(user.id, 'user')} className="text-yellow-600 hover:text-yellow-900 mr-4">
                      Jadikan User
                    </button>
                  )}
                  <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">
                    Hapus User
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

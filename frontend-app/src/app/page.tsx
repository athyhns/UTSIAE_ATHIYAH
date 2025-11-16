// frontend-app/src/app/page.tsx - Task Management Dashboard

'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { authApi, userApi } from '@/lib/api';

// === GraphQL: Task Management (Task Service) ===
const GET_TASKS = gql`
  query GetTasks {
    tasks {
      id
      title
      description
      status
      assignee
      createdAt
      updatedAt
      activities {
        id
        message
        author
        createdAt
      }
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($title: String!, $description: String!, $assignee: String!) {
    createTask(title: $title, description: $description, assignee: $assignee) {
      id
      title
      description
      status
      assignee
    }
  }
`;

const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $status: TaskStatus) {
    updateTask(id: $id, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

const ADD_TASK_ACTIVITY = gql`
  mutation AddTaskActivity($taskId: ID!, $message: String!) {
    addTaskActivity(taskId: $taskId, message: $message) {
      id
      taskId
      message
      author
      createdAt
    }
  }
`;

const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;
// ======================================

/**
 * Komponen Utama
 */
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <AuthComponent onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  return <DashboardComponent onLogout={handleLogout} />;
}

/**
 * Komponen Autentikasi
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
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Team Task Management</h1>
      <p className="text-sm text-slate-500 mb-6 text-center">
        Sign in to manage tasks with your team.
      </p>
      {error && <p className="text-red-400 text-center mb-4 text-sm">{error}</p>}

      <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
        {isRegistering && (
          <>
            <input
              type="text"
              name="name"
              placeholder="Full name"
              onChange={handleChange}
              className="border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 w-full text-sm"
              required
            />
            <input
              type="number"
              name="age"
              placeholder="Age"
              onChange={handleChange}
              className="border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 w-full text-sm"
              required
            />
          </>
        )}
        <input
          type="email"
          name="email"
          placeholder="Email address"
          onChange={handleChange}
          className="border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 w-full text-sm"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          className="border border-slate-300 bg-white text-slate-900 rounded-md px-3 py-2 w-full text-sm"
          required
        />

        <button
          type="submit"
          className="bg-[#F5C0D3] hover:bg-[#f2a9c5] text-slate-900 px-4 py-2 rounded-md w-full text-sm font-medium transition-colors"
        >
          {isRegistering ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        onClick={() => setIsRegistering(!isRegistering)}
        className="text-xs text-center w-full mt-4 text-[#F5C0D3] hover:text-[#f2a9c5]"
      >
        {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
      </button>
    </div>
  );
}

// FUNGSI HELPER: Decode Token
function getDecodedToken(): { name: string; role: string } | null {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      name: payload.name || 'User',
      role: payload.role || 'user',
    };
  } catch (e) {
    return null;
  }
}

/**
 * Komponen Dashboard (Task Management)
 */
function DashboardComponent({ onLogout }: { onLogout: () => void }) {
  const { data, loading, error, refetch } = useQuery(GET_TASKS);

  const [createTask] = useMutation(CREATE_TASK, { refetchQueries: [GET_TASKS] });
  const [updateTask] = useMutation(UPDATE_TASK, { refetchQueries: [GET_TASKS] });
  const [addTaskActivity] = useMutation(ADD_TASK_ACTIVITY, { refetchQueries: [GET_TASKS] });
  const [deleteTask] = useMutation(DELETE_TASK, { refetchQueries: [GET_TASKS] });

  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [activityInputs, setActivityInputs] = useState<Record<string, string>>({});

  const [userData, setUserData] = useState<{ name: string; role: string } | null>(null);
  useEffect(() => {
    setUserData(getDecodedToken());
  }, []);
  const userName = userData?.name || 'User';
  const userRole = userData?.role || 'user';

  const handleNewTaskChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setNewTask({ ...newTask, [e.target.name]: e.target.value });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.description.trim()) return;
    try {
      await createTask({
        variables: {
          title: newTask.title,
          description: newTask.description,
          assignee: userName,
        },
      });
      setNewTask({ title: '', description: '' });
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleChangeStatus = async (taskId: string, status: string) => {
    try {
      await updateTask({ variables: { id: taskId, status } });
    } catch (err: any) {
      alert(err.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Yakin ingin menghapus task ini?')) return;
    try {
      await deleteTask({ variables: { id: taskId } });
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  const handleActivityInputChange = (taskId: string, value: string) => {
    setActivityInputs((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleAddActivity = async (taskId: string) => {
    const message = activityInputs[taskId];
    if (!message?.trim()) return;
    try {
      await addTaskActivity({ variables: { taskId, message } });
      setActivityInputs((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err: any) {
      alert(err.message || 'Failed to add activity');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
        <p className="text-sm text-slate-400">Memuat tugas...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
        <p className="text-sm text-red-500">Gagal memuat tugas: {error.message}</p>
      </div>
    );
  }

  const tasks = data?.tasks || [];
  const grouped = {
    TODO: tasks.filter((t: any) => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter((t: any) => t.status === 'IN_PROGRESS'),
    DONE: tasks.filter((t: any) => t.status === 'DONE'),
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200 px-8 py-4 flex items-center justify-between bg-white">
        <div>
          <h1 className="text-2xl font-bold">Team Task Board</h1>
          <p className="text-sm text-slate-500">
            Realtime task management with REST User Service &amp; GraphQL Task Service
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-sm text-slate-900">{userName}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{userRole}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs px-3 py-1 border border-slate-300 rounded bg-white hover:bg-slate-100 text-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="px-8 py-6 grid grid-cols-[270px,1fr] gap-6">
        {/* Sidebar kiri: create task + admin panel */}
        <aside className="space-y-6">
          <NewTaskCard
            newTask={newTask}
            onChange={handleNewTaskChange}
            onSubmit={handleCreateTask}
          />
          {userRole === 'admin' && <AdminPanel />}
        </aside>

        {/* Kolom-kanban */}
        <section className="grid grid-cols-3 gap-4">
          <TaskColumn
            title="To Do"
            status="TODO"
            tasks={grouped.TODO}
            userName={userName}
            userRole={userRole}
            onStatusChange={handleChangeStatus}
            onDelete={handleDeleteTask}
            activityInputs={activityInputs}
            onActivityChange={handleActivityInputChange}
            onAddActivity={handleAddActivity}
          />
          <TaskColumn
            title="In Progress"
            status="IN_PROGRESS"
            tasks={grouped.IN_PROGRESS}
            userName={userName}
            userRole={userRole}
            onStatusChange={handleChangeStatus}
            onDelete={handleDeleteTask}
            activityInputs={activityInputs}
            onActivityChange={handleActivityInputChange}
            onAddActivity={handleAddActivity}
          />
          <TaskColumn
            title="Done"
            status="DONE"
            tasks={grouped.DONE}
            userName={userName}
            userRole={userRole}
            onStatusChange={handleChangeStatus}
            onDelete={handleDeleteTask}
            activityInputs={activityInputs}
            onActivityChange={handleActivityInputChange}
            onAddActivity={handleAddActivity}
          />
        </section>
      </main>
    </div>
  );
}

// === Komponen: Kartu Create Task di Sidebar ===
function NewTaskCard({
  newTask,
  onChange,
  onSubmit,
}: {
  newTask: { title: string; description: string };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 mb-2">Create new task</h2>
      <p className="text-xs text-slate-500 mb-3">
        Tambahkan task baru ke board dan assign ke dirimu.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="text"
          name="title"
          placeholder="Task title"
          value={newTask.title}
          onChange={onChange}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900"
          required
        />
        <textarea
          name="description"
          placeholder="Short description"
          value={newTask.description}
          onChange={onChange}
          className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-900 h-20"
          required
        />
        <button
          type="submit"
          className="w-full bg-[#F5C0D3] hover:bg-[#f2a9c5] text-slate-900 rounded px-3 py-1.5 text-xs font-semibold"
        >
          Add task
        </button>
      </form>
    </div>
  );
}

// === Komponen: Kolom Task (Kanban) ===
function TaskColumn({
  title,
  status,
  tasks,
  userName,
  userRole,
  onStatusChange,
  onDelete,
  activityInputs,
  onActivityChange,
  onAddActivity,
}: {
  title: string;
  status: string;
  tasks: any[];
  userName: string;
  userRole: string;
  onStatusChange: (taskId: string, status: string) => void;
  onDelete: (taskId: string) => void;
  activityInputs: Record<string, string>;
  onActivityChange: (taskId: string, value: string) => void;
  onAddActivity: (taskId: string) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500">
          {title}
        </h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F5C0D3] text-slate-900">
          {tasks.length} task
        </span>
      </div>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">{task.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                  {task.description}
                </p>
              </div>
              {(userRole === 'admin' || task.assignee === userName) && (
                <button
                  onClick={() => onDelete(task.id)}
                  className="text-[10px] text-red-500 hover:text-red-600"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="mt-2 flex justify-between items-center text-[11px] text-slate-500">
              <span>
                Assignee:{' '}
                <span className="text-slate-900 font-medium">{task.assignee}</span>
              </span>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(task.id, e.target.value)}
                className="bg-white border border-slate-300 text-[11px] rounded px-1.5 py-0.5"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            {/* Activity */}
            <div className="mt-3 border-t border-slate-200 pt-2">
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Activity</p>
              <div className="max-h-20 overflow-y-auto space-y-1 mb-1">
                {task.activities?.map((a: any) => (
                  <p key={a.id} className="text-[11px] text-slate-500">
                    <span className="text-slate-900">{a.author}</span>: {a.message}
                  </p>
                ))}
                {(!task.activities || task.activities.length === 0) && (
                  <p className="text-[11px] text-slate-400">Belum ada aktivitas.</p>
                )}
              </div>
              <div className="flex gap-1">
                <input
                  className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-900"
                  placeholder="Tambah catatan singkat..."
                  value={activityInputs[task.id] || ''}
                  onChange={(e) => onActivityChange(task.id, e.target.value)}
                />
                <button
                  onClick={() => onAddActivity(task.id)}
                  disabled={!(activityInputs[task.id] || '').trim()}
                  className="text-[11px] px-2 rounded bg-[#F5C0D3] text-slate-900 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-[11px] text-slate-400">Belum ada task di kolom ini.</p>
        )}
      </div>
    </div>
  );
}

// === KOMPONEN PANEL ADMIN: Manajemen User (REST User Service) ===
function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Gagal mengambil daftar user:', error);
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

  if (loading) return <p className="text-xs text-slate-500">Memuat panel admin...</p>;

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-amber-700 mb-2">
        Admin Panel: User Management
      </h2>
      <div className="max-h-64 overflow-y-auto">
        <table className="min-w-full text-[11px] text-amber-900">
          <thead className="bg-amber-100">
            <tr>
              <th className="px-2 py-1 text-left font-medium uppercase">Nama</th>
              <th className="px-2 py-1 text-left font-medium uppercase">Email</th>
              <th className="px-2 py-1 text-left font-medium uppercase">Role</th>
              <th className="px-2 py-1 text-left font-medium uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-amber-200">
                <td className="px-2 py-1 whitespace-nowrap">{user.name}</td>
                <td className="px-2 py-1 whitespace-nowrap">{user.email}</td>
                <td className="px-2 py-1 whitespace-nowrap">{user.role}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {user.role === 'user' ? (
                    <button
                      onClick={() => handleChangeRole(user.id, 'admin')}
                      className="text-[10px] text-emerald-600 hover:text-emerald-700 mr-2"
                    >
                      Jadikan Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleChangeRole(user.id, 'user')}
                      className="text-[10px] text-amber-600 hover:text-amber-700 mr-2"
                  >
                      Jadikan User
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-[10px] text-red-500 hover:text-red-600"
                  >
                    Hapus
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

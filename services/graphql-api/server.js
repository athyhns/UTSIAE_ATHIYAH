// services/graphql-api/server.js - Task Service (GraphQL)

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// --- Import untuk Subscription via graphql-ws ---
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
// -----------------------------------------------

// ====== JWT Public Key Integration (Auth from User Service) ======
const AUTH_PUBLIC_KEY_URL = process.env.AUTH_PUBLIC_KEY_URL;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const PUBLIC_KEY_ENDPOINTS = [
  AUTH_PUBLIC_KEY_URL,
  AUTH_SERVICE_URL ? `${AUTH_SERVICE_URL.replace(/\/$/, '')}/api/auth/public-key` : null,
  'http://rest-api:3001/api/auth/public-key',
  'http://localhost:3001/api/auth/public-key',
].filter(Boolean);

let cachedAuthPublicKey = '';

async function getAuthPublicKey() {
  if (cachedAuthPublicKey) {
    return cachedAuthPublicKey;
  }

  for (const endpoint of PUBLIC_KEY_ENDPOINTS) {
    try {
      const response = await axios.get(endpoint);
      if (response.data) {
        cachedAuthPublicKey = response.data;
        console.log(`Task GraphQL API cached auth public key from ${endpoint}`);
        return cachedAuthPublicKey;
      }
    } catch (error) {
      console.warn(`Task GraphQL API failed to fetch public key from ${endpoint}: ${error.message}`);
    }
  }

  return '';
}

async function decodeToken(token) {
  const publicKey = await getAuthPublicKey();
  if (!publicKey) {
    throw new Error('Public key unavailable for token verification');
  }

  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
}

getAuthPublicKey().catch((error) => {
  console.warn('Task GraphQL API initial public key fetch failed:', error.message);
});
// ================================================================

const app = express();
const pubsub = new PubSub();

// Event names untuk subscription
const TASK_CREATED = 'TASK_CREATED';
const TASK_UPDATED = 'TASK_UPDATED';
const TASK_DELETED = 'TASK_DELETED';
const TASK_ACTIVITY_ADDED = 'TASK_ACTIVITY_ADDED';

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://api-gateway:3000',
      'http://frontend-app:3002',
    ],
    credentials: true,
  }),
);

// === Database in-memory: Tasks & TaskActivities ===
let tasks = [
  {
    id: 't1',
    title: 'Setup project structure',
    description: 'Inisialisasi repository, konfigurasi Docker, dan API Gateway.',
    status: 'TODO', // TODO | IN_PROGRESS | DONE
    assignee: 'John Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    title: 'Implement JWT authentication',
    description: 'Integrasi JWT RS256 antara User Service dan API Gateway.',
    status: 'IN_PROGRESS',
    assignee: 'Jane Smith',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let taskActivities = [
  {
    id: 'a1',
    taskId: 't2',
    message: 'Task created',
    author: 'Jane Smith',
    createdAt: new Date().toISOString(),
  },
];
// ==================================================

// === Schema GraphQL: Task Management ===
const typeDefs = `
  enum TaskStatus {
    TODO
    IN_PROGRESS
    DONE
  }

  type Task {
    id: ID!
    title: String!
    description: String!
    status: TaskStatus!
    assignee: String!
    createdAt: String!
    updatedAt: String!
    activities: [TaskActivity!]!
  }

  type TaskActivity {
    id: ID!
    taskId: ID!
    message: String!
    author: String!
    createdAt: String!
  }

  type Query {
    tasks: [Task!]!
    task(id: ID!): Task
  }

  type Mutation {
    createTask(title: String!, description: String!, assignee: String!): Task!
    updateTask(id: ID!, title: String, description: String, status: TaskStatus, assignee: String): Task!
    addTaskActivity(taskId: ID!, message: String!): TaskActivity!
    deleteTask(id: ID!): Boolean!
  }

  type Subscription {
    taskCreated: Task!
    taskUpdated: Task!
    taskDeleted: ID!
    taskActivityAdded: TaskActivity!
  }
`;

// === Resolvers: Task Management + Authorization ===
const resolvers = {
  Query: {
    tasks: () => tasks,
    task: (_, { id }) => tasks.find((task) => task.id === id),
  },

  Task: {
    activities: (parent) => taskActivities.filter((a) => a.taskId === parent.id),
  },

  Mutation: {
    createTask: (_, { title, description, assignee }, context) => {
      if (!context.userId) {
        throw new Error('Authentication required to create a task.');
      }

      const now = new Date().toISOString();
      const task = {
        id: uuidv4(),
        title,
        description,
        status: 'TODO',
        assignee: assignee || context.userName || 'Unassigned',
        createdAt: now,
        updatedAt: now,
      };

      tasks.push(task);
      pubsub.publish(TASK_CREATED, { taskCreated: task });
      return task;
    },

    updateTask: (_, { id, title, description, status, assignee }, context) => {
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new Error('Task not found');
      }

      const task = tasks[idx];

      // Hanya admin atau assignee yang boleh mengubah task
      if (context.userRole !== 'admin' && task.assignee !== context.userName) {
        throw new Error('You are not allowed to update this task.');
      }

      const updated = {
        ...task,
        ...(title && { title }),
        ...(description && { description }),
        ...(status && { status }),
        ...(assignee && { assignee }),
        updatedAt: new Date().toISOString(),
      };

      tasks[idx] = updated;
      pubsub.publish(TASK_UPDATED, { taskUpdated: updated });
      return updated;
    },

    addTaskActivity: (_, { taskId, message }, context) => {
      if (!context.userId) {
        throw new Error('Authentication required to add activity.');
      }

      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      const activity = {
        id: uuidv4(),
        taskId,
        message,
        author: context.userName || 'Unknown',
        createdAt: new Date().toISOString(),
      };

      taskActivities.push(activity);
      pubsub.publish(TASK_ACTIVITY_ADDED, { taskActivityAdded: activity });
      return activity;
    },

    deleteTask: (_, { id }, context) => {
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) {
        return false;
      }

      const task = tasks[idx];

      // Hanya admin atau assignee yang boleh menghapus task
      if (context.userRole !== 'admin' && task.assignee !== context.userName) {
        throw new Error('You are not allowed to delete this task.');
      }

      tasks.splice(idx, 1);
      taskActivities = taskActivities.filter((a) => a.taskId !== id);
      pubsub.publish(TASK_DELETED, { taskDeleted: id });
      return true;
    },
  },

  Subscription: {
    taskCreated: {
      subscribe: () => pubsub.asyncIterator([TASK_CREATED]),
    },
    taskUpdated: {
      subscribe: () => pubsub.asyncIterator([TASK_UPDATED]),
    },
    taskDeleted: {
      subscribe: () => pubsub.asyncIterator([TASK_DELETED]),
    },
    taskActivityAdded: {
      subscribe: () => pubsub.asyncIterator([TASK_ACTIVITY_ADDED]),
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

async function startServer() {
  const server = new ApolloServer({
    schema,
    context: async ({ req }) => {
      // Membaca header yang disuntikkan Gateway, termasuk fallback decode token langsung
      let userId = req.headers['x-user-id'] || '';
      let userName = req.headers['x-user-name'] || 'Guest';
      let userEmail = req.headers['x-user-email'] || '';
      const headerTeams = req.headers['x-user-teams'];
      let userTeams = headerTeams ? headerTeams.split(',').filter(Boolean) : [];
      let userRole = req.headers['x-user-role'] || 'user';

      if (!userId) {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        if (token) {
          try {
            const decoded = await decodeToken(token);
            if (decoded) {
              userId = decoded.userId || userId;
              userName = decoded.name || userName;
              userEmail = decoded.email || userEmail;
              userTeams = Array.isArray(decoded.teams) ? decoded.teams : userTeams;
              userRole = decoded.role || userRole;
            }
          } catch (error) {
            console.warn('Task GraphQL API token verification fallback failed:', error.message);
          }
        }
      }

      return { userId, userName, userEmail, userTeams, userRole, req };
    },
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;

  // Setup Subscription server
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({ server: httpServer, path: server.graphqlPath });
  useServer({ schema }, wsServer);

  httpServer.listen(PORT, () => {
    console.log(`Task Service (GraphQL) running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'task-graphql-api',
    timestamp: new Date().toISOString(),
    data: {
      tasks: tasks.length,
      activities: taskActivities.length,
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Task GraphQL API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

startServer().catch((error) => {
  console.error('Failed to start Task GraphQL server:', error);
  process.exit(1);
});

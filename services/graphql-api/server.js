// services/graphql-api/server.js (Kode Lengkap & Stabil)

const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// --- Impor untuk FIX Subscription ---
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { useServer } = require('graphql-ws/lib/use/ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
// ------------------------------------

const AUTH_PUBLIC_KEY_URL = process.env.AUTH_PUBLIC_KEY_URL;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL;
const PUBLIC_KEY_ENDPOINTS = [
  AUTH_PUBLIC_KEY_URL,
  AUTH_SERVICE_URL ? `${AUTH_SERVICE_URL.replace(/\/$/, '')}/api/auth/public-key` : null,
  'http://rest-api:3001/api/auth/public-key',
  'http://localhost:3001/api/auth/public-key'
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
        console.log(`GraphQL API cached auth public key from ${endpoint}`);
        return cachedAuthPublicKey;
      }
    } catch (error) {
      console.warn(`GraphQL API failed to fetch public key from ${endpoint}: ${error.message}`);
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

getAuthPublicKey().catch(error => {
  console.warn('GraphQL API initial public key fetch failed:', error.message);
});

const app = express();
const pubsub = new PubSub();

const POST_ADDED = 'POST_ADDED';
const COMMENT_ADDED = 'COMMENT_ADDED';
const POST_UPDATED = 'POST_UPDATED';
const POST_DELETED = 'POST_DELETED';

app.use(cors({
  origin: [
    'http://localhost:3000', 'http://localhost:3002',
    'http://api-gateway:3000', 'http://frontend-app:3002'
  ],
  credentials: true
}));

// === Database In-Memory ASLI (Posts/Comments) ===
let posts = [
  { id: '1', title: 'Welcome to Microservices Security', content: 'This post is secured by JWT passed through the API Gateway!', author: 'John Doe', createdAt: new Date().toISOString() },
  { id: '2', title: 'Authentication is Working', content: 'Check the logs when you try to delete this post as a non-admin!', author: 'Jane Smith', createdAt: new Date().toISOString() }
];
let comments = [
  { id: '1', postId: '1', content: 'I am a secure comment!', author: 'John Doe', createdAt: new Date().toISOString() }
];
// ===============================================

// === Skema GraphQL ASLI (Type Definitions) - DENGAN INPUT AUTHOR ===
const typeDefs = `
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
    createdAt: String!
    comments: [Comment!]!
  }
  type Comment {
    id: ID!
    postId: ID!
    content: String!
    author: String!
    createdAt: String!
  }
  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
  }
  type Mutation {
    createPost(title: String!, content: String!, author: String!): Post!
    updatePost(id: ID!, title: String, content: String): Post!
    deletePost(id: ID!): Boolean!
    createComment(postId: ID!, content: String!, author: String!): Comment!
    deleteComment(id: ID!): Boolean!
  }
  type Subscription {
    postAdded: Post!
    commentAdded: Comment!
    postUpdated: Post!
    postDeleted: ID!
  }
`;

// === Resolvers ASLI (dengan logika Role Admin) ===
const resolvers = {
  Query: { posts: () => posts, post: (_, { id }) => posts.find(post => post.id === id), comments: (_, { postId }) => comments.filter(comment => comment.postId === postId) },
  Post: { comments: (parent) => comments.filter(comment => comment.postId === parent.id) },

  Mutation: {
    // RESOLVER createPost - MENGAMBIL AUTHOR DARI INPUT
    createPost: (_, { title, content, author }, context) => { // <-- AUTHOR DIKEMBALIKAN
      const postAuthor = author;
      if (!context.userId) { throw new Error('Authentication required to create a post.'); }

      const newPost = { id: uuidv4(), title, content, author: postAuthor, createdAt: new Date().toISOString() };
      posts.push(newPost);
      pubsub.publish(POST_ADDED, { postAdded: newPost });
      return newPost;
    },

    updatePost: (_, { id, title, content }) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) { throw new Error('Post not found'); }
      const updatedPost = { ...posts[postIndex], ...(title && { title }), ...(content && { content }) };
      posts[postIndex] = updatedPost;
      pubsub.publish(POST_UPDATED, { postUpdated: updatedPost });
      return updatedPost;
    },

    deletePost: (_, { id }, context) => {
      const postIndex = posts.findIndex(post => post.id === id);
      if (postIndex === -1) { return false; }
      const post = posts[postIndex];
      
      // LOGIKA HAK AKSES ADMIN
      if (context.userRole === 'admin' || post.author === context.userName) {
        comments = comments.filter(comment => comment.postId !== id);
        posts.splice(postIndex, 1);
        pubsub.publish(POST_DELETED, { postDeleted: id });
        return true;
      } else {
        throw new Error('You are not authorized to delete this post.');
      }
    },

    // RESOLVER createComment - MENGAMBIL AUTHOR DARI INPUT
    createComment: (_, { postId, content, author }, context) => { // <-- AUTHOR DIKEMBALIKAN
      const commentAuthor = author;
      if (!context.userId) { throw new Error('Authentication required to comment.'); }

      const post = posts.find(p => p.id === postId);
      if (!post) { throw new Error('Post not found'); }
      const newComment = { id: uuidv4(), postId, content, author: commentAuthor, createdAt: new Date().toISOString() };
      comments.push(newComment);
      pubsub.publish(COMMENT_ADDED, { commentAdded: newComment });
      return newComment;
    },

    deleteComment: (_, { id }) => {
      const commentIndex = comments.findIndex(comment => comment.id === id);
      if (commentIndex === -1) { return false; }
      comments.splice(commentIndex, 1);
      return true;
    },
  },

  Subscription: {
    postAdded: { subscribe: () => pubsub.asyncIterator([POST_ADDED]) },
    commentAdded: { subscribe: () => pubsub.asyncIterator([COMMENT_ADDED]) },
    postUpdated: { subscribe: () => pubsub.asyncIterator([POST_UPDATED]) },
    postDeleted: { subscribe: () => pubsub.asyncIterator([POST_DELETED]) },
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
            console.warn('GraphQL API token verification fallback failed:', error.message);
          }
        }
      }

      return { userId, userName, userEmail, userTeams, userRole, req };
    },
    // ... (plugins) ...
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const PORT = process.env.PORT || 4000;
  
  // FIX: Setup Subscription yang Benar
  const httpServer = createServer(app);
  const wsServer = new WebSocketServer({ server: httpServer, path: server.graphqlPath });
  useServer({ schema }, wsServer);
  httpServer.listen(PORT, () => {
    console.log(`🚀 Post/Comment Service (GraphQL) running on port ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'post-comment-graphql-api',
    timestamp: new Date().toISOString(),
    data: {
      posts: posts.length,
      comments: comments.length
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('GraphQL API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

startServer().catch(error => {
  console.error('Failed to start GraphQL server:', error);
  process.exit(1);
});

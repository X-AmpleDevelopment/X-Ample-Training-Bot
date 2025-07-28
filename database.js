const { MongoClient } = require('mongodb');

// MongoDB connection string - use environment variable or fallback
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://iamxample:Yamool2003!@eu-west-1-cluster.d50ic.mongodb.net/';
const DATABASE_NAME = 'xample_trainer';
const COLLECTIONS = {
  USER_STATUS: 'user_status',
  USER_QUIZ_PROGRESS: 'user_quiz_progress',
  USER_TRAINING_PROGRESS: 'user_training_progress',
  CONFIG: 'config'
};

let client = null;
let db = null;

// Initialize database connection
async function connectToDatabase() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    console.log('✅ Connected to MongoDB successfully!');
    
    // Ensure indexes exist
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

// Create database indexes for better performance
async function createIndexes() {
  try {
    // User status collection - index on userId
    await db.collection(COLLECTIONS.USER_STATUS).createIndex({ userId: 1 }, { unique: true });
    
    // User quiz progress collection - index on userId
    await db.collection(COLLECTIONS.USER_QUIZ_PROGRESS).createIndex({ userId: 1 }, { unique: true });
    
    // User training progress collection - index on userId
    await db.collection(COLLECTIONS.USER_TRAINING_PROGRESS).createIndex({ userId: 1 }, { unique: true });
    
    // Config collection - index on configType
    await db.collection(COLLECTIONS.CONFIG).createIndex({ configType: 1 }, { unique: true });
    
    console.log('✅ Database indexes created successfully!');
  } catch (error) {
    console.error('❌ Failed to create indexes:', error);
  }
}

// Load user status from database
async function loadUserStatus(userId) {
  try {
    const result = await db.collection(COLLECTIONS.USER_STATUS).findOne({ userId });
    return result ? result.status : {};
  } catch (error) {
    console.error('❌ Error loading user status:', error);
    return {};
  }
}

// Save user status to database
async function saveUserStatus(userId, status) {
  try {
    await db.collection(COLLECTIONS.USER_STATUS).updateOne(
      { userId },
      { $set: { userId, status, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('❌ Error saving user status:', error);
    return false;
  }
}

// Load user quiz progress from database
async function loadUserQuizProgress(userId) {
  try {
    const result = await db.collection(COLLECTIONS.USER_QUIZ_PROGRESS).findOne({ userId });
    return result ? result.progress : null;
  } catch (error) {
    console.error('❌ Error loading user quiz progress:', error);
    return null;
  }
}

// Save user quiz progress to database
async function saveUserQuizProgress(userId, progress) {
  try {
    if (progress) {
      await db.collection(COLLECTIONS.USER_QUIZ_PROGRESS).updateOne(
        { userId },
        { $set: { userId, progress, updatedAt: new Date() } },
        { upsert: true }
      );
    } else {
      // Remove progress if null/undefined
      await db.collection(COLLECTIONS.USER_QUIZ_PROGRESS).deleteOne({ userId });
    }
    return true;
  } catch (error) {
    console.error('❌ Error saving user quiz progress:', error);
    return false;
  }
}

// Load user training progress from database
async function loadUserTrainingProgress(userId) {
  try {
    const result = await db.collection(COLLECTIONS.USER_TRAINING_PROGRESS).findOne({ userId });
    return result ? result.progress : null;
  } catch (error) {
    console.error('❌ Error loading user training progress:', error);
    return null;
  }
}

// Save user training progress to database
async function saveUserTrainingProgress(userId, progress) {
  try {
    if (progress) {
      await db.collection(COLLECTIONS.USER_TRAINING_PROGRESS).updateOne(
        { userId },
        { $set: { userId, progress, updatedAt: new Date() } },
        { upsert: true }
      );
    } else {
      // Remove progress if null/undefined
      await db.collection(COLLECTIONS.USER_TRAINING_PROGRESS).deleteOne({ userId });
    }
    return true;
  } catch (error) {
    console.error('❌ Error saving user training progress:', error);
    return false;
  }
}

// Load configuration from database
async function loadConfig() {
  try {
    const result = await db.collection(COLLECTIONS.CONFIG).findOne({ configType: 'bot_config' });
    return result ? result.config : getDefaultConfig();
  } catch (error) {
    console.error('❌ Error loading config:', error);
    return getDefaultConfig();
  }
}

// Save configuration to database
async function saveConfig(config) {
  try {
    await db.collection(COLLECTIONS.CONFIG).updateOne(
      { configType: 'bot_config' },
      { $set: { configType: 'bot_config', config, updatedAt: new Date() } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('❌ Error saving config:', error);
    return false;
  }
}

// Get default configuration
function getDefaultConfig() {
  return {
    onboarding: {},
    quizzes: {},
    resources: {},
    announceChannel: null,
    reminderFrequencyHours: 24
  };
}

// Load all data for a user
async function loadUserData(userId) {
  try {
    const [userStatus, userQuizProgress, userTrainingProgress] = await Promise.all([
      loadUserStatus(userId),
      loadUserQuizProgress(userId),
      loadUserTrainingProgress(userId)
    ]);
    
    return {
      userStatus,
      userQuizProgress,
      userTrainingProgress
    };
  } catch (error) {
    console.error('❌ Error loading user data:', error);
    return {
      userStatus: {},
      userQuizProgress: null,
      userTrainingProgress: null
    };
  }
}

// Save all data for a user
async function saveUserData(userId, data) {
  try {
    const promises = [];
    
    if (data.userStatus !== undefined) {
      promises.push(saveUserStatus(userId, data.userStatus));
    }
    
    if (data.userQuizProgress !== undefined) {
      promises.push(saveUserQuizProgress(userId, data.userQuizProgress));
    }
    
    if (data.userTrainingProgress !== undefined) {
      promises.push(saveUserTrainingProgress(userId, data.userTrainingProgress));
    }
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('❌ Error saving user data:', error);
    return false;
  }
}

// Get all users with their status
async function getAllUsers() {
  try {
    const users = await db.collection(COLLECTIONS.USER_STATUS).find({}).toArray();
    return users;
  } catch (error) {
    console.error('❌ Error getting all users:', error);
    return [];
  }
}

// Get database statistics
async function getDatabaseStats() {
  try {
    const stats = {
      userStatus: await db.collection(COLLECTIONS.USER_STATUS).countDocuments(),
      userQuizProgress: await db.collection(COLLECTIONS.USER_QUIZ_PROGRESS).countDocuments(),
      userTrainingProgress: await db.collection(COLLECTIONS.USER_TRAINING_PROGRESS).countDocuments(),
      config: await db.collection(COLLECTIONS.CONFIG).countDocuments()
    };
    return stats;
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return {};
  }
}

// Close database connection
async function closeConnection() {
  if (client) {
    await client.close();
    console.log('✅ Database connection closed.');
  }
}

module.exports = {
  connectToDatabase,
  loadUserStatus,
  saveUserStatus,
  loadUserQuizProgress,
  saveUserQuizProgress,
  loadUserTrainingProgress,
  saveUserTrainingProgress,
  loadConfig,
  saveConfig,
  loadUserData,
  saveUserData,
  getAllUsers,
  getDatabaseStats,
  closeConnection,
  COLLECTIONS
}; 
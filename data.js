const { connectToDatabase, loadConfig, saveConfig, loadUserData, saveUserData, getAllUsers, getDatabaseStats } = require('./database.js');

// Role mappings
const ROLE_IDS = {
  'XD | Support': '1399073847269003476',
  'XD | Administrator': '1242390702311342126',
  'XD | SLT': '1242390702311342129'
};

const ROLE_NAMES = {
  '1399073847269003476': 'XD | Support',
  '1242390702311342126': 'XD | Administrator',
  '1242390702311342129': 'XD | SLT'
};

// Prerequisites system - defines which roles must be completed before accessing others
const ROLE_PREREQUISITES = {
  '1242390702311342126': ['1399073847269003476'], // Admin requires Support
  '1242390702311342129': ['1242390702311342126']  // SLT requires Admin
};

// Branching scenarios - different training paths based on answers
const BRANCHING_SCENARIOS = {
  '1399073847269003476': { // Support Staff
    'escalation_handling': {
      question: "A user is being very aggressive. What's your first step?",
      options: {
        'stay_calm': {
          text: "Stay calm and professional",
          next: "Great! Now what do you do if they continue being aggressive?",
          followUp: "Correct! Always maintain professionalism. Next: Offer to take this to DMs or escalate to Admin."
        },
        'get_angry': {
          text: "Match their energy",
          next: "That's not the right approach. What should you do instead?",
          followUp: "Incorrect. Always stay professional. Let's try again: Stay calm and offer to help."
        }
      }
    },
    'technical_issue': {
      question: "A user reports a technical problem. What do you ask first?",
      options: {
        'gather_info': {
          text: "Ask for specific details about the problem",
          next: "Good! What specific information do you need?",
          followUp: "Perfect! Always gather: What happened, when, what they were doing, any error messages."
        },
        'immediate_solution': {
          text: "Give them the first solution that comes to mind",
          next: "Not the best approach. What should you do first?",
          followUp: "Incorrect. Always understand the problem first. Ask for details before suggesting solutions."
        }
      }
    }
  },
  '1242390702311342126': { // Admin
    'conflict_resolution': {
      question: "Two users are arguing in a channel. What's your first action?",
      options: {
        'separate_users': {
          text: "Separate them and take to DMs",
          next: "Good approach! What do you do if one user refuses to cooperate?",
          followUp: "Excellent! Separate first, then investigate. If they refuse, consider temporary mute or escalation."
        },
        'immediate_ban': {
          text: "Ban both users immediately",
          next: "That's too extreme. What's a better first step?",
          followUp: "Incorrect. Always try de-escalation first. Separate users, then investigate the situation."
        }
      }
    },
    'staff_management': {
      question: "A Support Staff member is consistently late to their shifts. What do you do?",
      options: {
        'private_talk': {
          text: "Have a private conversation with them",
          next: "Good! What do you discuss in this conversation?",
          followUp: "Correct! Address issues privately first. Discuss expectations, offer support, set clear goals."
        },
        'public_calling': {
          text: "Call them out publicly in the staff channel",
          next: "That's not appropriate. What's a better approach?",
          followUp: "Incorrect. Never address performance issues publicly. Always handle privately and professionally."
        }
      }
    }
  }
};

// Enhanced onboarding with media support
const DEFAULT_ONBOARDING = {
  '1399073847269003476': [
    {
      text: 'Welcome to Support Staff! 🛠️',
      media: 'https://example.com/support-welcome.png',
      mediaType: 'image'
    },
    {
      text: 'Your main role is to help users with their questions and issues.',
      media: null
    },
    {
      text: 'Always be patient and friendly when assisting users.',
      media: 'https://example.com/support-etiquette.png',
      mediaType: 'image'
    },
    {
      text: 'If you cannot solve an issue, escalate it to an Admin.',
      media: 'https://example.com/escalation-process.mp4',
      mediaType: 'video'
    },
    {
      text: 'Check the #resources channel for helpful guides.',
      media: null
    }
  ],
  '1242390702311342126': [
    {
      text: 'Welcome to the Admin team! ⚡',
      media: 'https://example.com/admin-welcome.png',
      mediaType: 'image'
    },
    {
      text: 'You oversee Support Staff and manage server operations.',
      media: null
    },
    {
      text: 'Handle escalated issues from Support Staff.',
      media: 'https://example.com/admin-escalation.png',
      mediaType: 'image'
    },
    {
      text: 'Manage user roles and permissions.',
      media: 'https://example.com/role-management.mp4',
      mediaType: 'video'
    },
    {
      text: 'Review admin resources in #resources.',
      media: null
    }
  ],
  '1242390702311342129': [
    {
      text: 'Welcome to the Senior Leadership Team! 👑',
      media: 'https://example.com/slt-welcome.png',
      mediaType: 'image'
    },
    {
      text: 'Set the vision and direction for the server.',
      media: null
    },
    {
      text: 'Make final decisions on major issues.',
      media: 'https://example.com/leadership-decision.png',
      mediaType: 'image'
    },
    {
      text: 'Support Admins and Support Staff.',
      media: null
    },
    {
      text: 'Review leadership resources in #resources.',
      media: null
    }
  ]
};

const DEFAULT_QUIZZES = {
  '1399073847269003476': [
    { q: 'What should you do if you cannot solve a user issue?', a: 'escalate' },
    { q: 'Where do you assist users?', a: 'tickets' },
    { q: 'Should you ever be rude to users?', a: 'no' },
    { q: 'Who do you ask for help if unsure?', a: 'admin' }
  ],
  '1242390702311342126': [
    { q: 'Who do you oversee?', a: 'support staff' },
    { q: 'What do you manage besides users?', a: 'staff' },
    { q: 'Where do you find the admin guide?', a: 'resources' },
    { q: 'Who do you escalate major issues to?', a: 'senior leadership team' }
  ],
  '1242390702311342129': [
    { q: 'Who sets the vision for the server?', a: 'senior leadership team' },
    { q: 'Who makes final decisions?', a: 'senior leadership team' },
    { q: 'Where are server policies found?', a: 'resources' },
    { q: 'Who supports Admins and Support Staff?', a: 'senior leadership team' }
  ]
};

const DEFAULT_RESOURCES = {
  '1399073847269003476': [
    '[Support Handbook](https://x-ampledevelopment.co.uk/support-handbook)',
    '[Support FAQ](https://x-ampledevelopment.co.uk/support-faq)'
  ],
  '1242390702311342126': [
    '[Admin Guide](https://x-ampledevelopment.co.uk/admin-guide)',
    '[Moderation Tools](https://x-ampledevelopment.co.uk/mod-tools)'
  ],
  '1242390702311342129': [
    '[Leadership Resources](https://x-ampledevelopment.co.uk/leadership)',
    '[Server Policy](https://x-ampledevelopment.co.uk/policy)'
  ]
};

// Get default configuration
function getDefaultConfig() {
  return {
    onboarding: {},
    quizzes: {},
    resources: {},
    announceChannel: null,
    reminderFrequencyHours: 24,
    vacancies: {
      channel: null,
      positions: {},
      applications: {}
    }
  };
}

// Initialize database connection and data
let isInitialized = false;
let data = {
  userStatus: {},
  userQuizProgress: {},
  userTrainingProgress: {},
  config: {
    onboarding: {},
    quizzes: {},
    resources: {},
    announceChannel: null,
    reminderFrequencyHours: 24,
    vacancies: {
      channel: null,
      positions: {},
      applications: {}
    }
  }
};

// Initialize database connection
async function initializeDatabase() {
  if (isInitialized) return;
  
  try {
    await connectToDatabase();
    await loadData();
    isInitialized = true;
    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Load data from database
async function loadData() {
  try {
    // Load configuration
    const config = await loadConfig();
    
    // Ensure defaults are applied
    ensureDefaults(config);
    
    // Update the data object
    data.config = config;
    
    console.log('✅ Data loaded from MongoDB successfully!');
    console.log('Config keys after loading:', Object.keys(data.config));
    console.log('Onboarding roles:', Object.keys(data.config.onboarding));
    console.log('Quiz roles:', Object.keys(data.config.quizzes));
    console.log('Resource roles:', Object.keys(data.config.resources));
  } catch (error) {
    console.error('❌ Error loading data from database:', error.message);
    console.error('💡 This might be a database connection issue. Check your MongoDB URI and network connection.');
    throw error;
  }
}

// Ensure default values are present in config
function ensureDefaults(config) {
  // Always ensure config objects exist
  if (!config.onboarding) config.onboarding = {};
  if (!config.quizzes) config.quizzes = {};
  if (!config.resources) config.resources = {};
  if (!config.vacancies) config.vacancies = { channel: null, positions: {}, applications: {} };
  
  // Only apply defaults if they're missing (don't overwrite existing data)
  for (const key of Object.keys(DEFAULT_ONBOARDING)) {
    if (!config.onboarding[key]) {
      config.onboarding[key] = DEFAULT_ONBOARDING[key];
    }
  }
  for (const key of Object.keys(DEFAULT_QUIZZES)) {
    if (!config.quizzes[key]) {
      config.quizzes[key] = DEFAULT_QUIZZES[key];
    }
  }
  for (const key of Object.keys(DEFAULT_RESOURCES)) {
    if (!config.resources[key]) {
      config.resources[key] = DEFAULT_RESOURCES[key];
    }
  }
}

// Save data to database
async function saveData() {
  try {
    await saveConfig(data.config);
    return true;
  } catch (error) {
    console.error('❌ Error saving data to database:', error);
    return false;
  }
}

// Load user data from database
async function loadUserDataFromDB(userId) {
  try {
    const userData = await loadUserData(userId);
    
    // Update the data object with user-specific data
    if (userData.userStatus) {
      data.userStatus[userId] = userData.userStatus;
    }
    if (userData.userQuizProgress) {
      data.userQuizProgress[userId] = userData.userQuizProgress;
    }
    if (userData.userTrainingProgress) {
      data.userTrainingProgress[userId] = userData.userTrainingProgress;
    }
    
    return userData;
  } catch (error) {
    console.error('❌ Error loading user data from database:', error);
    return {
      userStatus: {},
      userQuizProgress: null,
      userTrainingProgress: null
    };
  }
}

// Save user data to database
async function saveUserDataToDB(userId, userData) {
  try {
    await saveUserData(userId, userData);
    return true;
  } catch (error) {
    console.error('❌ Error saving user data to database:', error);
    return false;
  }
}

// Check prerequisites for a role
function checkPrerequisites(userId, targetRole, userStatus) {
  const prerequisites = ROLE_PREREQUISITES[targetRole] || [];
  
  for (const prereqRole of prerequisites) {
    const prereqStatus = userStatus[prereqRole];
    if (!prereqStatus || !prereqStatus.certified) {
      const missingRoleName = ROLE_NAMES[prereqRole] || 'Unknown Role';
      const targetRoleName = ROLE_NAMES[targetRole] || 'Unknown Role';
      
      return {
        allowed: false,
        missing: prereqRole,
        message: `You must complete **${missingRoleName}** training and certification before accessing **${targetRoleName}** training.\n\nComplete the prerequisites first, then try again.`
      };
    }
  }
  
  return { allowed: true };
}

// Get database statistics
async function getStats() {
  try {
    return await getDatabaseStats();
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    return {};
  }
}

// Get all users
async function getAllUsersFromDB() {
  try {
    return await getAllUsers();
  } catch (error) {
    console.error('❌ Error getting all users:', error);
    return [];
  }
}

module.exports = {
  data,
  initializeDatabase,
  loadData,
  saveData,
  loadUserDataFromDB,
  saveUserDataToDB,
  ROLE_IDS,
  ROLE_NAMES,
  ROLE_PREREQUISITES,
  checkPrerequisites,
  BRANCHING_SCENARIOS,
  getStats,
  getAllUsersFromDB
}; 
const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ROLE_IDS, ROLE_NAMES, checkPrerequisites, BRANCHING_SCENARIOS, loadUserDataFromDB, saveUserDataToDB } = require('./data');

const roleDescriptions = {
  [ROLE_IDS['XD | Support']]: 'XD | Support help users, answer questions, and escalate issues to XD | Administrators when needed.',
  [ROLE_IDS['XD | Administrator']]: 'XD | Administrators moderate the server, manage roles, and support the XD | Support.',
  [ROLE_IDS['XD | SLT']]: 'The XD | SLT sets the direction for the server and makes final decisions.'
};
const faqs = {
  [ROLE_IDS['XD | Support']]: [
    { q: 'How do I escalate an issue?', a: 'Ping an XD | Administrator in #staff or DM them directly.' },
    { q: 'Where do I find the support handbook?', a: 'Check #resources or use /resources.' }
  ],
  [ROLE_IDS['XD | Administrator']]: [
    { q: 'How do I ban a user?', a: 'Right-click their name and select Ban, or use /ban if enabled.' },
    { q: 'How do I add a new XD | Support?', a: 'Assign them the XD | Support role in the server settings.' }
  ],
  [ROLE_IDS['XD | SLT']]: [
    { q: 'How do I schedule a meeting?', a: 'Use the #leadership channel or DM all SLT members.' },
    { q: 'Where are server policies?', a: 'See #resources or use /resources.' }
  ]
};
const funFacts = [
  'Did you know? The first message ever sent on Discord was "Welcome to Discord"!',
  'Motivation: Every great team starts with great training! 💪',
  'Tip: Use /help to see all available commands.'
];
const XD_CERTIFIED_ROLE_ID = '1399062392821780583';
const CONFIG_ROLE_ID = '1242390702378455060';

function isConfigRole(member) {
  return member && member.roles && member.roles.cache.has(CONFIG_ROLE_ID);
}

// roleChoices will be created inside the module.exports to ensure ROLE_IDS are loaded

module.exports = [
  // Ping
  {
    data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
    async execute(interaction) {
      await interaction.reply('Pong!');
    }
  },
  // Trainme (with buttons in DM)
  {
    data: new SlashCommandBuilder()
      .setName('trainme')
      .setDescription('Start interactive onboarding for a staff role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to train for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      const role = String(interaction.options.getString('role'));
      console.log('/trainme received role:', role, 'Available onboarding keys:', Object.keys(data.config.onboarding));
      
      // Load user data from database
      const userData = await loadUserDataFromDB(interaction.user.id);
      const userStatus = userData.userStatus || {};
      
      // Check prerequisites
      const prereqCheck = checkPrerequisites(interaction.user.id, role, userStatus);
      
      if (!prereqCheck.allowed) {
        await interaction.reply({ 
          content: `❌ **Prerequisites Not Met!**\n\n${prereqCheck.message}\n\nComplete the required training first, then try again.`, 
          ephemeral: true 
        });
        return;
      }
      
      // Check if onboarding steps exist for this role
      if (!data.config.onboarding[role] || !Array.isArray(data.config.onboarding[role]) || data.config.onboarding[role].length === 0) {
        await interaction.reply({ 
          content: `❌ **No training available!**\n\nNo onboarding steps found for ${ROLE_NAMES[role]}. Please contact an administrator.`, 
          ephemeral: true 
        });
        return;
      }
      
      // Always reply to the interaction first
      await interaction.reply({ content: `Starting training for ${ROLE_NAMES[role]}...`, ephemeral: true });
      
      // Then try to send the training
      try {
        // Update in-memory data and save to database
        data.userTrainingProgress[interaction.user.id] = { role, step: 0 };
        await saveUserDataToDB(interaction.user.id, { userTrainingProgress: { role, step: 0 } });
        
        await sendOnboardingStep(interaction.user, data, saveData, interaction);
        await interaction.editReply({ content: `Check your DMs for onboarding steps for ${ROLE_NAMES[role]}!`, ephemeral: true });
      } catch (error) {
        console.error('Error starting training:', error);
        await interaction.editReply({ content: `Failed to start training. Please check your DM settings and try again.`, ephemeral: true });
      }
    }
  },
  // Quiz
  {
    data: new SlashCommandBuilder()
      .setName('quiz')
      .setDescription('Start a quiz for a staff role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to quiz for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      let role = String(interaction.options.getString('role'));
      console.log('/quiz received role:', role, 'Available quiz keys:', Object.keys(data.config.quizzes));
      
      // Check if quiz exists for this role
      if (!data.config.quizzes[role] || !Array.isArray(data.config.quizzes[role]) || data.config.quizzes[role].length === 0) {
        console.error('Quiz role not found:', role, 'Available:', Object.keys(data.config.quizzes));
        await interaction.reply({ 
          content: `❌ **No quiz available!**\n\nNo quiz found for ${ROLE_NAMES[role]}. Please contact an administrator.`, 
          ephemeral: true 
        });
        return;
      }
      
      // Load user data from database
      const userData = await loadUserDataFromDB(interaction.user.id);
      const userStatus = userData.userStatus || {};
      
      // Check prerequisites
      const prereqCheck = checkPrerequisites(interaction.user.id, role, userStatus);
      
      if (!prereqCheck.allowed) {
        await interaction.reply({ 
          content: `❌ **Prerequisites Not Met!**\n\n${prereqCheck.message}\n\nComplete the required training first, then try again.`, 
          ephemeral: true 
        });
        return;
      }
      
      // Always reply to the interaction first
      await interaction.reply({ content: `Starting quiz for ${ROLE_NAMES[role]}...`, ephemeral: true });
      
      // Then try to send the quiz
      try {
        // Update in-memory data and save to database
        data.userQuizProgress[interaction.user.id] = { role, q: 0, correct: 0 };
        await saveUserDataToDB(interaction.user.id, { userQuizProgress: { role, q: 0, correct: 0 } });
        
        await sendQuizStep(interaction.user, data, saveData, interaction);
        await interaction.editReply({ content: `Quiz started for ${ROLE_NAMES[role]}! Check your DMs.`, ephemeral: true });
      } catch (error) {
        console.error('Error starting quiz:', error);
        await interaction.editReply({ content: `Failed to start quiz. Please check your DM settings and try again.`, ephemeral: true });
      }
    }
  },
  // Answer (for quiz) - REMOVED - Now using buttons in DMs
  // Myprogress
  {
    data: new SlashCommandBuilder().setName('myprogress').setDescription('Show your training and certification progress'),
    async execute(interaction, context) {
      const { data } = context;
      
      // Load user data from database
      const userData = await loadUserDataFromDB(interaction.user.id);
      const status = userData.userStatus;
      
      if (!status || Object.keys(status).length === 0) {
        await interaction.reply({ content: 'No progress found. Start with /trainme.', ephemeral: true });
        return;
      }
      
      let reply = '**Your Training Progress:**\n';
      for (const role of Object.keys(status)) {
        reply += `\n__${ROLE_NAMES[role]}__\n`;
        reply += `Onboarding: ${status[role].onboarding ? '✅' : '❌'}\n`;
        reply += `Quiz: ${status[role].quiz ? '✅' : '❌'}\n`;
        reply += `Certified: ${status[role].certified ? '🏅' : '❌'}\n`;
      }
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Leaderboard
  {
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Show the leaderboard for certified users')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to show leaderboard for').setRequired(false)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data } = context;
      let role = interaction.options.getString('role') || ROLE_IDS['XD | Support'];
      role = String(role); // Ensure role is a string
      const certified = [];
      for (const [userId, roles] of Object.entries(data.userStatus)) {
        if (roles[role] && roles[role].certified) certified.push(userId);
      }
      if (certified.length === 0) {
        await interaction.reply({ content: `No certified users for ${ROLE_NAMES[role]}.`, ephemeral: true });
        return;
      }
      let reply = `🏅 **${ROLE_NAMES[role]} Leaderboard** 🏅\n`;
      for (let i = 0; i < certified.length; i++) {
        const user = await interaction.client.users.fetch(certified[i]);
        reply += `${i + 1}. ${user.tag}\n`;
      }
      await interaction.reply({ content: reply, ephemeral: false });
    }
  },
  // Review
  {
    data: new SlashCommandBuilder()
      .setName('review')
      .setDescription('Review quiz questions and answers for a role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to review').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data } = context;
      const role = interaction.options.getString('role');
      role = String(role); // Ensure role is a string
      if (!data.config.quizzes[role]) {
        await interaction.reply({ content: 'Role not found.', ephemeral: true });
        return;
      }
      let reply = `**${ROLE_NAMES[role]} Quiz Review:**\n`;
      for (const q of data.config.quizzes[role]) {
        reply += `Q: ${q.q}\nA: ${q.a}\n`;
      }
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Training Path
  {
    data: new SlashCommandBuilder()
      .setName('trainingpath')
      .setDescription('Show your training progression path and prerequisites'),
    async execute(interaction, context) {
      const { data } = context;
      const userStatus = data.userStatus[interaction.user.id] || {};
      
      let reply = '**🎯 Your Training Progression Path:**\n\n';
      
      // Support Staff (Entry Level)
      const supportStatus = userStatus[ROLE_IDS['XD | Support']];
      reply += `**1. XD | Support** ${supportStatus?.certified ? '✅' : '❌'}\n`;
      reply += `   - Entry level position\n`;
      reply += `   - No prerequisites required\n\n`;
      
      // Admin (Requires Support)
      const adminStatus = userStatus[ROLE_IDS['XD | Administrator']];
      reply += `**2. XD | Administrator** ${adminStatus?.certified ? '✅' : '❌'}\n`;
      reply += `   - Requires: XD | Support certification\n`;
      reply += `   - Manages Support Staff and server operations\n\n`;
      
      // SLT (Requires Admin)
      const sltStatus = userStatus[ROLE_IDS['XD | SLT']];
      reply += `**3. XD | SLT** ${sltStatus?.certified ? '✅' : '❌'}\n`;
      reply += `   - Requires: XD | Administrator certification\n`;
      reply += `   - Senior leadership and final decision making\n\n`;
      
      reply += `**Next Steps:**\n`;
      if (!supportStatus?.certified) {
        reply += `• Start with /trainme role:XD | Support\n`;
      } else if (!adminStatus?.certified) {
        reply += `• Continue with /trainme role:XD | Administrator\n`;
      } else if (!sltStatus?.certified) {
        reply += `• Advance to /trainme role:XD | SLT\n`;
      } else {
        reply += `• 🎉 You've completed all training paths! Congratulations!\n`;
      }
      
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Media Management
  {
    data: new SlashCommandBuilder()
      .setName('addmedia')
      .setDescription('Add media to a training step (config role only)')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      )
      .addIntegerOption(opt =>
        opt.setName('step').setDescription('Step number (1-based)').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('mediaurl').setDescription('Media URL').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('mediatype').setDescription('Media type').setRequired(true)
          .addChoices(
            { name: 'Image', value: 'image' },
            { name: 'Video', value: 'video' }
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to add media.', ephemeral: true });
        return;
      }
      
      const role = String(interaction.options.getString('role'));
      const stepIndex = interaction.options.getInteger('step') - 1; // Convert to 0-based
      const mediaUrl = interaction.options.getString('mediaurl');
      const mediaType = interaction.options.getString('mediatype');
      
      if (!data.config.onboarding[role] || stepIndex >= data.config.onboarding[role].length) {
        await interaction.reply({ content: 'Invalid step number.', ephemeral: true });
        return;
      }
      
      const step = data.config.onboarding[role][stepIndex];
      if (typeof step === 'string') {
        // Convert string step to object format
        data.config.onboarding[role][stepIndex] = {
          text: step,
          media: mediaUrl,
          mediaType: mediaType
        };
      } else {
        // Update existing object
        step.media = mediaUrl;
        step.mediaType = mediaType;
      }
      
      saveData();
      await interaction.reply({ 
        content: `✅ Media added to step ${stepIndex + 1} for ${ROLE_NAMES[role]}.`, 
        ephemeral: true 
      });
    }
  },
  // Debug User Data
  {
    data: new SlashCommandBuilder()
      .setName('debuguser')
      .setDescription('Debug user data (config role only)')
      .addUserOption(opt =>
        opt.setName('user').setDescription('User to debug').setRequired(true)
      ),
    async execute(interaction, context) {
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to debug user data.', ephemeral: true });
        return;
      }
      
      const targetUser = interaction.options.getUser('user');
      const userData = await loadUserDataFromDB(targetUser.id);
      
      let reply = `**🔍 Debug Data for ${targetUser.tag}:**\n\n`;
      reply += `**User Status:**\n${JSON.stringify(userData.userStatus, null, 2)}\n\n`;
      reply += `**Quiz Progress:**\n${JSON.stringify(userData.userQuizProgress, null, 2)}\n\n`;
      reply += `**Training Progress:**\n${JSON.stringify(userData.userTrainingProgress, null, 2)}`;
      
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Set Announce Channel
  {
    data: new SlashCommandBuilder()
      .setName('setannounce')
      .setDescription('Set the announcement channel (config role only)')
      .addChannelOption(opt =>
        opt.setName('channel').setDescription('Channel for announcements').setRequired(true)
      ),
    async execute(interaction, context) {
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to set the announcement channel.', ephemeral: true });
        return;
      }
      
      const channel = interaction.options.getChannel('channel');
      const { data, saveData } = context;
      
      // Update config
      data.config.announceChannel = channel.id;
      saveData();
      
      await interaction.reply({ 
        content: `✅ Announcement channel set to <#${channel.id}>`, 
        ephemeral: true 
      });
    }
  },
  // View Announce Channel
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('View current announcement channel (config role only)'),
    async execute(interaction, context) {
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to view the announcement channel.', ephemeral: true });
        return;
      }
      
      const { data } = context;
      const channelId = data.config.announceChannel;
      
      if (channelId) {
        await interaction.reply({ 
          content: `📢 Current announcement channel: <#${channelId}>`, 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: '❌ No announcement channel set. Use `/setannounce` to set one.', 
          ephemeral: true 
        });
      }
    }
  },
  // Test Announcement
  {
    data: new SlashCommandBuilder()
      .setName('testannounce')
      .setDescription('Test the announcement channel (config role only)'),
    async execute(interaction, context) {
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to test announcements.', ephemeral: true });
        return;
      }
      
      const { data } = context;
      const channelId = data.config.announceChannel;
      
      if (!channelId) {
        await interaction.reply({ 
          content: '❌ No announcement channel set. Use `/setannounce` to set one.', 
          ephemeral: true 
        });
        return;
      }
      
      try {
        const announceChannel = await interaction.client.channels.fetch(channelId);
        if (announceChannel) {
          await announceChannel.send(`🧪 **Test Announcement** - This is a test message from the X-Ample Training bot!`);
          await interaction.reply({ 
            content: `✅ Test announcement sent to <#${channelId}>`, 
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            content: `❌ Could not find channel <#${channelId}>`, 
            ephemeral: true 
          });
        }
      } catch (error) {
        console.error('Error sending test announcement:', error);
        await interaction.reply({ 
          content: `❌ Error sending test announcement: ${error.message}`, 
          ephemeral: true 
        });
      }
    }
  },
  // Database Stats
  {
    data: new SlashCommandBuilder()
      .setName('dbstats')
      .setDescription('Show database statistics (config role only)'),
    async execute(interaction, context) {
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to view database stats.', ephemeral: true });
        return;
      }
      
      const { getStats } = require('./data.js');
      const stats = await getStats();
      
      let reply = '**📊 Database Statistics:**\n\n';
      reply += `👥 **Users with Status:** ${stats.userStatus || 0}\n`;
      reply += `📝 **Active Quiz Sessions:** ${stats.userQuizProgress || 0}\n`;
      reply += `🎓 **Active Training Sessions:** ${stats.userTrainingProgress || 0}\n`;
      reply += `⚙️ **Configuration Records:** ${stats.config || 0}\n\n`;
      reply += `**Total Records:** ${Object.values(stats).reduce((a, b) => a + b, 0)}`;
      
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Branching Scenarios
  {
    data: new SlashCommandBuilder()
      .setName('scenarios')
      .setDescription('Start interactive branching scenarios for a role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role for scenarios').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      const role = String(interaction.options.getString('role'));
      
      // Check prerequisites
      const userStatus = data.userStatus[interaction.user.id] || {};
      const prereqCheck = checkPrerequisites(interaction.user.id, role, userStatus);
      
      if (!prereqCheck.allowed) {
        await interaction.reply({ 
          content: `❌ **Prerequisites Not Met!**\n\n${prereqCheck.message}\n\nComplete the required training first, then try again.`, 
          ephemeral: true 
        });
        return;
      }
      
      const scenarios = BRANCHING_SCENARIOS[role];
      if (!scenarios) {
        await interaction.reply({ 
          content: `No branching scenarios available for ${ROLE_NAMES[role]} yet.`, 
          ephemeral: true 
        });
        return;
      }
      
      // Start the first scenario
      const firstScenarioKey = Object.keys(scenarios)[0];
      const firstScenario = scenarios[firstScenarioKey];
      
      await interaction.reply({ 
        content: `Starting branching scenarios for ${ROLE_NAMES[role]}... Check your DMs!`, 
        ephemeral: true 
      });
      
      try {
        await sendBranchingScenario(interaction.user, role, firstScenarioKey, firstScenario, data, saveData, interaction);
      } catch (error) {
        console.error('Error starting scenarios:', error);
        await interaction.editReply({ 
          content: `Failed to start scenarios. Please check your DM settings and try again.`, 
          ephemeral: true 
        });
      }
    }
  },
  // Retake
  {
    data: new SlashCommandBuilder()
      .setName('retake')
      .setDescription('Retake a quiz for a role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to retake quiz for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data } = context;
      const role = interaction.options.getString('role');
      role = String(role); // Ensure role is a string
      if (!data.config.quizzes[role]) {
        await interaction.reply({ content: 'Role not found.', ephemeral: true });
        return;
      }
      data.userQuizProgress[interaction.user.id] = { role, q: 0, correct: 0 };
      await interaction.user.send(`Retaking the **${ROLE_NAMES[role]}** quiz! Answer each question by using /a answer:<your answer>.`);
      await interaction.user.send(`Q1: ${data.config.quizzes[role][0].q}`);
      await interaction.reply({ content: `Quiz restarted for ${ROLE_NAMES[role]}! Check your DMs.`, ephemeral: true });
    }
  },
  // Staffstats (admin only)
  {
    data: new SlashCommandBuilder()
      .setName('staffstats')
      .setDescription('Show staff certification stats')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, context) {
      const { data } = context;
      let reply = '**Staff Certification Stats:**\n';
      for (const role of Object.keys(data.config.quizzes)) {
        let count = 0;
        for (const user of Object.values(data.userStatus)) {
          if (user[role] && user[role].certified) count++;
        }
        reply += `${ROLE_NAMES[role]}: ${count} certified\n`;
      }
      await interaction.reply({ content: reply, ephemeral: true });
    }
  },
  // Feedback
  {
    data: new SlashCommandBuilder()
      .setName('feedback')
      .setDescription('Send feedback to admins')
      .addStringOption(opt =>
        opt.setName('message').setDescription('Your feedback').setRequired(true)
      ),
    async execute(interaction) {
      const feedbackMsg = interaction.options.getString('message');
      const feedbackChannelId = '1399379467863982090';
      
      try {
        const feedbackChannel = await interaction.client.channels.fetch(feedbackChannelId);
        if (feedbackChannel) {
          await feedbackChannel.send(`📝 **Feedback from ${interaction.user}:**\n${feedbackMsg}`);
          await interaction.reply({ content: '✅ Thank you for your feedback! It has been sent to the feedback channel.', ephemeral: true });
        } else {
          await interaction.reply({ content: '❌ Error: Could not find the feedback channel. Please contact an administrator.', ephemeral: true });
        }
      } catch (error) {
        console.error('Error sending feedback:', error);
        await interaction.reply({ content: '❌ Error sending feedback. Please try again later.', ephemeral: true });
      }
    }
  },
  // Roleinfo
  {
    data: new SlashCommandBuilder()
      .setName('roleinfo')
      .setDescription('Get info about a staff role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to get info for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction) {
      const role = interaction.options.getString('role');
      role = String(role); // Ensure role is a string
      if (roleDescriptions[role]) {
        await interaction.reply({ content: `**${ROLE_NAMES[role]}:** ${roleDescriptions[role]}`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Role not found.', ephemeral: true });
      }
    }
  },
  // FAQ
  {
    data: new SlashCommandBuilder()
      .setName('faq')
      .setDescription('Get FAQs for a staff role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to get FAQs for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction) {
      const role = interaction.options.getString('role');
      role = String(role); // Ensure role is a string
      if (faqs[role]) {
        let reply = `**${ROLE_NAMES[role]} FAQ:**\n`;
        for (const item of faqs[role]) {
          reply += `Q: ${item.q}\nA: ${item.a}\n\n`;
        }
        await interaction.reply({ content: reply, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Role not found.', ephemeral: true });
      }
    }
  },
  // Resources
  {
    data: new SlashCommandBuilder()
      .setName('resources')
      .setDescription('Get resources for a staff role')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role to get resources for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data } = context;
      const role = interaction.options.getString('role');
      role = String(role); // Ensure role is a string
      if (data.config.resources[role]) {
        let reply = `**${ROLE_NAMES[role]} Resources:**\n` + data.config.resources[role].join('\n');
        await interaction.reply({ content: reply, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Role not found.', ephemeral: true });
      }
    }
  },
  // Config commands (restricted to config role)
  {
    data: new SlashCommandBuilder()
      .setName('setonboarding')
      .setDescription('Set onboarding steps for a role (config role only)')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      )
      .addStringOption(opt =>
        opt.setName('steps').setDescription('Steps separated by |').setRequired(true)
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to change onboarding steps.', ephemeral: true });
        return;
      }
      const role = interaction.options.getString('role');
      const steps = interaction.options.getString('steps').split('|').map(s => s.trim());
      data.config.onboarding[role] = steps;
      saveData();
      await interaction.reply({ content: `Onboarding steps for ${ROLE_NAMES[role]} updated.`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('setquiz')
      .setDescription('Set quiz questions for a role (config role only)')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      )
      .addStringOption(opt =>
        opt.setName('qapairs').setDescription('Q1|A1|Q2|A2...').setRequired(true)
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to change quiz questions.', ephemeral: true });
        return;
      }
      const role = interaction.options.getString('role');
      const qapairs = interaction.options.getString('qapairs').split('|');
      const quizArr = [];
      for (let i = 0; i < qapairs.length; i += 2) {
        if (qapairs[i] && qapairs[i+1]) quizArr.push({ q: qapairs[i], a: qapairs[i+1] });
      }
      data.config.quizzes[role] = quizArr;
      saveData();
      await interaction.reply({ content: `Quiz for ${ROLE_NAMES[role]} updated.`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('setresource')
      .setDescription('Set resources for a role (config role only)')
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      )
      .addStringOption(opt =>
        opt.setName('links').setDescription('Links separated by space').setRequired(true)
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      if (!isConfigRole(interaction.member)) {
        await interaction.reply({ content: 'You do not have permission to change resources.', ephemeral: true });
        return;
      }
      const role = interaction.options.getString('role');
      const links = interaction.options.getString('links').split(' ');
      data.config.resources[role] = links;
      saveData();
      await interaction.reply({ content: `Resources for ${ROLE_NAMES[role]} updated.`, ephemeral: true });
    }
  },
  // Job Vacancies Management
  {
    data: new SlashCommandBuilder()
      .setName('vacancies')
      .setDescription('Manage job vacancies (leadership only)')
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Add a new job vacancy')
          .addStringOption(opt =>
            opt.setName('title').setDescription('Job title').setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('department').setDescription('Department').setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('description').setDescription('Job description').setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('requirements').setDescription('Requirements (separate with commas)').setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('type').setDescription('Employment type').setRequired(true)
              .addChoices(
                { name: 'Full-time', value: 'full-time' },
                { name: 'Part-time', value: 'part-time' },
                { name: 'Contract', value: 'contract' },
                { name: 'Internship', value: 'internship' }
              )
          )
          .addStringOption(opt =>
            opt.setName('location').setDescription('Location (remote/onsite/hybrid)').setRequired(true)
              .addChoices(
                { name: 'Remote', value: 'remote' },
                { name: 'On-site', value: 'onsite' },
                { name: 'Hybrid', value: 'hybrid' }
              )
          )
          .addStringOption(opt =>
            opt.setName('salary').setDescription('Salary range (optional)')
          )
          .addStringOption(opt =>
            opt.setName('deadline').setDescription('Application deadline (YYYY-MM-DD)')
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('edit')
          .setDescription('Edit an existing job vacancy')
          .addStringOption(opt =>
            opt.setName('id').setDescription('Vacancy ID').setRequired(true)
          )
          .addStringOption(opt =>
            opt.setName('title').setDescription('Job title')
          )
          .addStringOption(opt =>
            opt.setName('department').setDescription('Department')
          )
          .addStringOption(opt =>
            opt.setName('description').setDescription('Job description')
          )
          .addStringOption(opt =>
            opt.setName('requirements').setDescription('Requirements (separate with commas)')
          )
          .addStringOption(opt =>
            opt.setName('salary').setDescription('Salary range')
          )
          .addStringOption(opt =>
            opt.setName('type').setDescription('Employment type')
              .addChoices(
                { name: 'Full-time', value: 'full-time' },
                { name: 'Part-time', value: 'part-time' },
                { name: 'Contract', value: 'contract' },
                { name: 'Internship', value: 'internship' }
              )
          )
          .addStringOption(opt =>
            opt.setName('location').setDescription('Location')
              .addChoices(
                { name: 'Remote', value: 'remote' },
                { name: 'On-site', value: 'onsite' },
                { name: 'Hybrid', value: 'hybrid' }
              )
          )
          .addStringOption(opt =>
            opt.setName('deadline').setDescription('Application deadline (YYYY-MM-DD)')
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('delete')
          .setDescription('Delete a job vacancy')
          .addStringOption(opt =>
            opt.setName('id').setDescription('Vacancy ID').setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all job vacancies')
          .addStringOption(opt =>
            opt.setName('department').setDescription('Filter by department')
          )
          .addStringOption(opt =>
            opt.setName('type').setDescription('Filter by employment type')
              .addChoices(
                { name: 'Full-time', value: 'full-time' },
                { name: 'Part-time', value: 'part-time' },
                { name: 'Contract', value: 'contract' },
                { name: 'Internship', value: 'internship' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('setchannel')
          .setDescription('Set the channel for job vacancy announcements')
          .addChannelOption(opt =>
            opt.setName('channel').setDescription('Channel for vacancy announcements').setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('announce')
          .setDescription('Announce a specific vacancy to the configured channel')
          .addStringOption(opt =>
            opt.setName('id').setDescription('Vacancy ID').setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('applications')
          .setDescription('Manage job applications')
          .addStringOption(opt =>
            opt.setName('action').setDescription('Action to perform').setRequired(true)
              .addChoices(
                { name: 'List All', value: 'list' },
                { name: 'View Specific', value: 'view' },
                { name: 'Update Status', value: 'status' }
              )
          )
          .addStringOption(opt =>
            opt.setName('vacancy_id').setDescription('Vacancy ID (for view/status actions)')
          )
          .addStringOption(opt =>
            opt.setName('application_id').setDescription('Application ID (for view/status actions)')
          )
          .addStringOption(opt =>
            opt.setName('new_status').setDescription('New status (for status action)')
              .addChoices(
                { name: 'Under Review', value: 'review' },
                { name: 'Interview Scheduled', value: 'interview' },
                { name: 'Accepted', value: 'accepted' },
                { name: 'Rejected', value: 'rejected' },
                { name: 'Withdrawn', value: 'withdrawn' }
              )
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      
      // Check if user has leadership role (Admin or SLT)
      const hasLeadershipRole = interaction.member.roles.cache.some(role => 
        role.id === ROLE_IDS['XD | Administrator'] || role.id === ROLE_IDS['XD | SLT']
      );
      
      if (!hasLeadershipRole) {
        await interaction.reply({ 
          content: '❌ **Access Denied!**\n\nOnly XD | Administrator and XD | SLT members can manage job vacancies.', 
          ephemeral: true 
        });
        return;
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      try {
        switch (subcommand) {
          case 'add':
            await handleAddVacancy(interaction, data, saveData);
            break;
          case 'edit':
            await handleEditVacancy(interaction, data, saveData);
            break;
          case 'delete':
            await handleDeleteVacancy(interaction, data, saveData);
            break;
          case 'list':
            await handleListVacancies(interaction, data);
            break;
          case 'setchannel':
            await handleSetChannel(interaction, data, saveData);
            break;
          case 'announce':
            await handleAnnounceVacancy(interaction, data);
            break;
          case 'applications':
            await handleApplicationsCommand(interaction, data, saveData);
            break;
          default:
            await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        }
      } catch (error) {
        console.error('Error in vacancies command:', error);
        await interaction.reply({ 
          content: '❌ An error occurred while processing your request. Please try again.', 
          ephemeral: true 
        });
      }
    }
  },
  // Public Job Vacancies Viewing
  {
    data: new SlashCommandBuilder()
      .setName('jobs')
      .setDescription('View available job vacancies')
      .addStringOption(opt =>
        opt.setName('department').setDescription('Filter by department')
      )
      .addStringOption(opt =>
        opt.setName('type').setDescription('Filter by employment type')
          .addChoices(
            { name: 'Full-time', value: 'full-time' },
            { name: 'Part-time', value: 'part-time' },
            { name: 'Contract', value: 'contract' },
            { name: 'Internship', value: 'internship' }
          )
      )
      .addStringOption(opt =>
        opt.setName('location').setDescription('Filter by location')
          .addChoices(
            { name: 'Remote', value: 'remote' },
            { name: 'On-site', value: 'onsite' },
            { name: 'Hybrid', value: 'hybrid' }
          )
      ),
    async execute(interaction, context) {
      const { data } = context;
      
      const departmentFilter = interaction.options.getString('department');
      const typeFilter = interaction.options.getString('type');
      const locationFilter = interaction.options.getString('location');
      
      const positions = data.config.vacancies?.positions || {};
      let filteredPositions = Object.values(positions).filter(pos => pos.status === 'active');
      
      // Apply filters
      if (departmentFilter) {
        filteredPositions = filteredPositions.filter(pos => 
          pos.department.toLowerCase().includes(departmentFilter.toLowerCase())
        );
      }
      
      if (typeFilter) {
        filteredPositions = filteredPositions.filter(pos => pos.type === typeFilter);
      }
      
      if (locationFilter) {
        filteredPositions = filteredPositions.filter(pos => pos.location === locationFilter);
      }
      
      if (filteredPositions.length === 0) {
        const filterText = [departmentFilter, typeFilter, locationFilter].filter(Boolean).join(' and ');
        await interaction.reply({ 
          content: `📭 **No Job Openings Found!**\n\nNo available positions match the filter: ${filterText || 'No filters applied'}\n\nCheck back later for new opportunities!`, 
          ephemeral: true 
        });
        return;
      }
      
      // Sort by creation date (newest first)
      filteredPositions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Create paginated embed
      const positionsPerPage = 5;
      const totalPages = Math.ceil(filteredPositions.length / positionsPerPage);
      const currentPage = 1;
      
      const embed = createJobsEmbed(filteredPositions, currentPage, totalPages, positionsPerPage, departmentFilter, typeFilter, locationFilter);
      
      // Create navigation buttons if there are multiple pages
      let components = [];
      if (totalPages > 1) {
        components = createJobsPaginationButtons(currentPage, totalPages, filteredPositions, departmentFilter, typeFilter, locationFilter);
      }
      
      await interaction.reply({ 
        embeds: [embed], 
        components: components,
        ephemeral: true 
      });
    }
  },
  // Apply for Job Vacancy
  {
    data: new SlashCommandBuilder()
      .setName('apply')
      .setDescription('Apply for a job vacancy')
      .addStringOption(opt =>
        opt.setName('vacancy_id').setDescription('Vacancy ID to apply for').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('message').setDescription('Your application message').setRequired(true)
      )
      .addStringOption(opt =>
        opt.setName('role').setDescription('Role you are applying for').setRequired(true)
          .addChoices(
            { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
            { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
            { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      const vacancyId = interaction.options.getString('vacancy_id');
      const message = interaction.options.getString('message');
      const role = interaction.options.getString('role');

      // Check if vacancy exists
      const vacancy = data.config.vacancies?.positions?.[vacancyId];
      if (!vacancy) {
        await interaction.reply({ 
          content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${vacancyId}\``, 
          ephemeral: true 
        });
        return;
      }

      // Check if user has already applied
      const existingApplication = Object.values(data.config.vacancies?.applications || {}).find(
        app => app.vacancyId === vacancyId && app.applicant.user.id === interaction.user.id
      );

      if (existingApplication) {
        await interaction.reply({ 
          content: `❌ **Already Applied!**\n\nYou have already applied for this vacancy. Your application is currently: **${existingApplication.status}**`, 
          ephemeral: true 
        });
        return;
      }

      // Create application
      const applicationId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const application = {
        id: applicationId,
        vacancyId: vacancyId,
        applicant: {
          user: {
            id: interaction.user.id,
            tag: interaction.user.tag
          },
          role: role,
          type: 'external' // or 'internal' if they already have a role
        },
        message: message,
        status: 'pending',
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Initialize applications array if it doesn't exist
      if (!data.config.vacancies.applications) {
        data.config.vacancies.applications = {};
      }

      data.config.vacancies.applications[applicationId] = application;
      await saveData();

      // Create confirmation embed
      const embed = {
        color: 0x00ff00,
        title: '✅ **Application Submitted Successfully!**',
        description: `Your application for **${vacancy.title}** has been submitted.`,
        fields: [
          {
            name: '📋 Application Details',
            value: `**Vacancy:** ${vacancy.title}\n**Department:** ${vacancy.department}\n**Role Applied For:** ${ROLE_NAMES[role]}\n**Status:** Pending Review`,
            inline: false
          },
          {
            name: '💬 Your Message',
            value: message.length > 1024 ? message.substring(0, 1021) + '...' : message,
            inline: false
          },
          {
            name: '🆔 Application ID',
            value: `\`${applicationId}\``,
            inline: false
          }
        ],
        footer: {
          text: 'Leadership will review your application and update you on the status.'
        },
        timestamp: new Date()
      };

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // Notify leadership in the configured channel if available
      if (data.config.vacancies.channel) {
        try {
          const channel = await interaction.client.channels.fetch(data.config.vacancies.channel);
          if (channel) {
            const notificationEmbed = {
              color: 0x0099ff,
              title: '📬 **New Job Application Received**',
              description: `A new application has been submitted for **${vacancy.title}**`,
              fields: [
                {
                  name: '👤 Applicant',
                  value: `${interaction.user.tag} (${interaction.user.id})`,
                  inline: true
                },
                {
                  name: '🎯 Role Applied For',
                  value: ROLE_NAMES[role],
                  inline: true
                },
                {
                  name: '📅 Applied At',
                  value: new Date().toLocaleDateString(),
                  inline: true
                },
                {
                  name: '🆔 Application ID',
                  value: `\`${applicationId}\``,
                  inline: false
                }
              ],
              footer: {
                text: 'Use /vacancies applications view to review this application'
              },
              timestamp: new Date()
            };

            await channel.send({ embeds: [notificationEmbed] });
          }
        } catch (error) {
          console.error('Failed to send application notification:', error);
        }
      }
    }
  },
  // Leadership Dashboard and Analytics
  {
    data: new SlashCommandBuilder()
      .setName('leadership')
      .setDescription('Leadership dashboard and analytics (Admin/SLT only)')
      .addSubcommand(subcommand =>
        subcommand
          .setName('dashboard')
          .setDescription('View leadership dashboard with key metrics')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('analytics')
          .setDescription('View detailed analytics and reports')
          .addStringOption(opt =>
            opt.setName('type').setDescription('Type of analytics to view').setRequired(true)
              .addChoices(
                { name: 'Training Progress', value: 'training' },
                { name: 'Quiz Performance', value: 'quizzes' },
                { name: 'Job Applications', value: 'applications' },
                { name: 'Staff Activity', value: 'activity' }
              )
          )
          .addStringOption(opt =>
            opt.setName('period').setDescription('Time period for analytics')
              .addChoices(
                { name: 'Last 7 Days', value: '7d' },
                { name: 'Last 30 Days', value: '30d' },
                { name: 'Last 90 Days', value: '90d' },
                { name: 'All Time', value: 'all' }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('staff')
          .setDescription('Manage staff members and roles')
          .addStringOption(opt =>
            opt.setName('action').setDescription('Action to perform').setRequired(true)
              .addChoices(
                { name: 'List All Staff', value: 'list' },
                { name: 'View Staff Member', value: 'view' },
                { name: 'Update Role', value: 'update' }
              )
          )
          .addUserOption(opt =>
            opt.setName('user').setDescription('User to manage (for view/update actions)')
          )
          .addStringOption(opt =>
            opt.setName('new_role').setDescription('New role to assign (for update action)')
              .addChoices(
                { name: 'XD | Support', value: ROLE_IDS['XD | Support'] },
                { name: 'XD | Administrator', value: ROLE_IDS['XD | Administrator'] },
                { name: 'XD | SLT', value: ROLE_IDS['XD | SLT'] }
              )
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('reports')
          .setDescription('Generate and view reports')
          .addStringOption(opt =>
            opt.setName('report_type').setDescription('Type of report to generate').setRequired(true)
              .addChoices(
                { name: 'Training Completion', value: 'training' },
                { name: 'Quiz Results', value: 'quizzes' },
                { name: 'Job Vacancies', value: 'vacancies' },
                { name: 'Staff Performance', value: 'performance' }
              )
          )
          .addStringOption(opt =>
            opt.setName('format').setDescription('Report format')
              .addChoices(
                { name: 'Discord Embed', value: 'embed' },
                { name: 'Text Summary', value: 'text' }
              )
          )
      ),
    async execute(interaction, context) {
      const { data, saveData } = context;
      
      // Check if user has leadership role (Admin or SLT)
      const hasLeadershipRole = interaction.member.roles.cache.some(role => 
        role.id === ROLE_IDS['XD | Administrator'] || role.id === ROLE_IDS['XD | SLT']
      );
      
      if (!hasLeadershipRole) {
        await interaction.reply({ 
          content: '❌ **Access Denied!**\n\nOnly XD | Administrator and XD | SLT members can access leadership tools.', 
          ephemeral: true 
        });
        return;
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      try {
        switch (subcommand) {
          case 'dashboard':
            await handleLeadershipDashboard(interaction, data);
            break;
          case 'analytics':
            await handleLeadershipAnalytics(interaction, data);
            break;
          case 'staff':
            await handleLeadershipStaff(interaction, data, saveData);
            break;
          case 'reports':
            await handleLeadershipReports(interaction, data);
            break;
          default:
            await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
        }
      } catch (error) {
        console.error('Error in leadership command:', error);
        await interaction.reply({ 
          content: '❌ An error occurred while processing your request. Please try again.', 
          ephemeral: true 
        });
      }
    }
  }
];

// Helper to send onboarding step with button
async function sendOnboardingStep(user, data, saveData, triggeringInteraction) {
  const progress = data.userTrainingProgress[user.id];
  if (!progress) return;
  
  const steps = data.config.onboarding[progress.role];
  if (!steps || !Array.isArray(steps)) {
    console.error('No onboarding steps found for role:', progress.role, 'Available keys:', Object.keys(data.config.onboarding));
    try {
      await user.send('❌ Error: No training steps found for this role. Please contact an administrator.');
    } catch (e) {
      if (triggeringInteraction && triggeringInteraction.guild) {
        await triggeringInteraction.followUp({ content: 'Error: No training steps found for this role.', ephemeral: true });
      }
    }
    data.userTrainingProgress[user.id] = undefined;
    saveData();
    return;
  }
  
  const step = progress.step;
  if (step < steps.length) {
    const fact = funFacts[Math.floor(Math.random() * funFacts.length)];
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
    );
    
    // Handle both old string format and new object format
    let stepText, stepMedia, stepMediaType;
    if (typeof steps[step] === 'string') {
      stepText = steps[step];
      stepMedia = null;
    } else {
      stepText = steps[step].text;
      stepMedia = steps[step].media;
      stepMediaType = steps[step].mediaType;
    }
    
    const messageContent = {
      content: `**${ROLE_NAMES[progress.role]} Training Step ${step + 1}/${steps.length}:**\n${stepText}\n\n_${fact}_`,
      components: [row]
    };
    
    // Add media if available
    if (stepMedia) {
      if (stepMediaType === 'image') {
        messageContent.files = [stepMedia];
      } else if (stepMediaType === 'video') {
        messageContent.content += `\n\n📹 **Video Guide:** ${stepMedia}`;
      }
    }
    
    try {
      await user.send(messageContent);
    } catch (e) {
      if (triggeringInteraction && triggeringInteraction.guild) {
        await triggeringInteraction.followUp({ content: 'I could not send you a DM. Please check your privacy settings.', ephemeral: true });
      }
    }
  } else {
    try {
      await user.send(`🎉 Training complete for **${ROLE_NAMES[progress.role]}**! Great job!`);
    } catch (e) {
      if (triggeringInteraction && triggeringInteraction.guild) {
        await triggeringInteraction.followUp({ content: 'I could not send you a DM. Please check your privacy settings.', ephemeral: true });
      }
    }
    
    // Load current user status from database
    const userData = await loadUserDataFromDB(user.id);
    const userStatus = userData.userStatus || {};
    console.log('Training completion - User data loaded for', user.id, ':', userStatus);
    
    // Update user status
    userStatus[progress.role] = userStatus[progress.role] || {};
    userStatus[progress.role].onboarding = true;
    
    // Save to database
    await saveUserDataToDB(user.id, { 
      userStatus: userStatus,
      userTrainingProgress: null 
    });
    
    // Update in-memory data
    data.userStatus[user.id] = userStatus;
    data.userTrainingProgress[user.id] = undefined;
    saveData();
    
    // Send announcement if channel is set
    if (data.config.announceChannel) {
      try {
        const announceChannel = await user.client.channels.fetch(data.config.announceChannel);
        if (announceChannel) {
          await announceChannel.send(`🎉 **Training Complete!** ${user} has completed their **${ROLE_NAMES[progress.role]}** onboarding training!`);
        }
      } catch (error) {
        console.error('Error sending announcement:', error);
      }
    }
  }
}

// Helper to send quiz step with text input
async function sendQuizStep(user, data, saveData, triggeringInteraction) {
  const progress = data.userQuizProgress[user.id];
  if (!progress) return;
  
  const quiz = data.config.quizzes[progress.role];
  if (!quiz || !Array.isArray(quiz)) {
    console.error('No quiz found for role:', progress.role, 'Available keys:', Object.keys(data.config.quizzes));
    try {
      await user.send('❌ Error: No quiz found for this role. Please contact an administrator.');
    } catch (e) {
      if (triggeringInteraction && triggeringInteraction.guild) {
        await triggeringInteraction.followUp({ content: 'Error: No quiz found for this role.', ephemeral: true });
      }
    }
    data.userQuizProgress[user.id] = undefined;
    saveData();
    return;
  }
  
  const questionIndex = progress.q;
  if (questionIndex < quiz.length) {
    const question = quiz[questionIndex];
    try {
      await user.send({
        content: `**${ROLE_NAMES[progress.role]} Quiz Question ${questionIndex + 1}/${quiz.length}:**\n${question.q}\n\nPlease type your answer in the chat. I'll check if it matches the expected answer.`
      });
    } catch (e) {
      if (triggeringInteraction && triggeringInteraction.guild) {
        await triggeringInteraction.followUp({ content: 'I could not send you a DM. Please check your privacy settings.', ephemeral: true });
      }
    }
  } else {
    // Quiz completed
    const passed = progress.correct === quiz.length;
    if (passed) {
      try {
        await user.send(`🎉 You passed the **${ROLE_NAMES[progress.role]}** quiz! You are now certified.`);
      } catch (e) {
        if (triggeringInteraction && triggeringInteraction.guild) {
          await triggeringInteraction.followUp({ content: 'You passed the quiz!', ephemeral: true });
        }
      }
      // Load current user status from database
      const userData = await loadUserDataFromDB(user.id);
      const userStatus = userData.userStatus || {};
      
      // Update user status
      userStatus[progress.role] = userStatus[progress.role] || {};
      userStatus[progress.role].quiz = true;
      userStatus[progress.role].certified = true;
      
      // Save to database
      await saveUserDataToDB(user.id, { 
        userStatus: userStatus,
        userQuizProgress: null 
      });
      
      // Update in-memory data
      data.userStatus[user.id] = userStatus;
      
      // Send announcement if channel is set
      if (data.config.announceChannel) {
        try {
          const announceChannel = await user.client.channels.fetch(data.config.announceChannel);
          if (announceChannel) {
            await announceChannel.send(`🏅 **Certification Achieved!** ${user} has passed the **${ROLE_NAMES[progress.role]}** quiz and is now certified!`);
          }
        } catch (error) {
          console.error('Error sending announcement:', error);
        }
      }
      
      // Assign XD Certified role if possible
      try {
        // Try to get the client from triggeringInteraction first
        const client = triggeringInteraction?.client;
        console.log('Role assignment - client available:', !!client);
        if (client) {
          console.log('Role assignment - guilds available:', client.guilds.cache.size);
          let roleAssigned = false;
          
          for (const guild of client.guilds.cache.values()) {
            try {
              console.log('Role assignment - checking guild:', guild.name);
              const member = await guild.members.fetch(user.id).catch(() => null);
              if (member) {
                console.log('Role assignment - member found, has role:', member.roles.cache.has(XD_CERTIFIED_ROLE_ID));
                if (!member.roles.cache.has(XD_CERTIFIED_ROLE_ID)) {
                  // Check if the role exists in the guild
                  const role = guild.roles.cache.get(XD_CERTIFIED_ROLE_ID);
                  if (role) {
                    await member.roles.add(XD_CERTIFIED_ROLE_ID);
                    console.log('Role assignment - role added successfully');
                    await user.send('You have been given the **XD Certified** role on the server!');
                    roleAssigned = true;
                    break; // Only assign once
                  } else {
                    console.log('Role assignment - role not found in guild:', guild.name);
                  }
                } else {
                  console.log('Role assignment - user already has the role');
                  await user.send('You already have the **XD Certified** role!');
                  roleAssigned = true;
                  break;
                }
              } else {
                console.log('Role assignment - member not found in guild:', guild.name);
              }
            } catch (e) {
              console.error('Error assigning role in guild:', guild.name, e);
            }
          }
          
          if (!roleAssigned) {
            await user.send('🎉 You passed the quiz! Please contact an administrator to get your **XD Certified** role.');
          }
        } else {
          // If no client available, just notify the user
          console.log('Role assignment - no client available');
          await user.send('🎉 You passed the quiz! Please contact an administrator to get your **XD Certified** role.');
        }
      } catch (e) {
        console.error('Error in role assignment:', e);
        await user.send('🎉 You passed the quiz! Please contact an administrator to get your **XD Certified** role.');
      }
    } else {
      try {
        await user.send(`You got ${progress.correct}/${quiz.length} correct. Try again with /quiz role:${progress.role}.`);
      } catch (e) {
        if (triggeringInteraction && triggeringInteraction.guild) {
          await triggeringInteraction.followUp({ content: `You got ${progress.correct}/${quiz.length} correct. Try again.`, ephemeral: true });
        }
      }
      // Load current user status from database
      const userData = await loadUserDataFromDB(user.id);
      const userStatus = userData.userStatus || {};
      
      // Update user status
      userStatus[progress.role] = userStatus[progress.role] || {};
      userStatus[progress.role].quiz = false;
      userStatus[progress.role].certified = false;
      
      // Save to database
      await saveUserDataToDB(user.id, { 
        userStatus: userStatus,
        userQuizProgress: null 
      });
      
      // Update in-memory data
      data.userStatus[user.id] = userStatus;
    }
    data.userQuizProgress[user.id] = undefined;
    saveData();
  }
}

async function sendBranchingScenario(user, role, scenarioKey, scenario, data, saveData, triggeringInteraction) {
  const buttons = [];
  
  for (const [optionKey, option] of Object.entries(scenario.options)) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`scenario_${role}_${scenarioKey}_${optionKey}`)
        .setLabel(option.text)
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  const row = new ActionRowBuilder().addComponents(buttons);
  
  try {
    await user.send({
      content: `**🎭 Branching Scenario: ${ROLE_NAMES[role]}**\n\n${scenario.question}`,
      components: [row]
    });
  } catch (e) {
    if (triggeringInteraction && triggeringInteraction.guild) {
      await triggeringInteraction.followUp({ 
        content: 'I could not send you a DM. Please check your privacy settings.', 
        ephemeral: true 
      });
    }
  }
}

// Job Vacancy Helper Functions
async function handleAddVacancy(interaction, data, saveData) {
  const title = interaction.options.getString('title');
  const department = interaction.options.getString('department');
  const description = interaction.options.getString('description');
  const requirements = interaction.options.getString('requirements');
  const salary = interaction.options.getString('salary');
  const type = interaction.options.getString('type');
  const location = interaction.options.getString('location');
  const deadline = interaction.options.getString('deadline');
  
  // Generate unique ID
  const id = `vac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create vacancy object
  const vacancy = {
    id,
    title,
    department,
    description,
    requirements: requirements.split(',').map(req => req.trim()),
    salary: salary || 'Competitive',
    type,
    location,
    deadline: deadline || null,
    createdAt: new Date().toISOString(),
    createdBy: interaction.user.id,
    status: 'active'
  };
  
  // Add to data
  if (!data.config.vacancies.positions) {
    data.config.vacancies.positions = {};
  }
  data.config.vacancies.positions[id] = vacancy;
  
  // Save to database
  await saveData();
  
  // Create embed for confirmation
  const embed = createVacancyEmbed(vacancy, '✅ **Vacancy Added Successfully!**');
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
  
  // Auto-announce if channel is configured
  if (data.config.vacancies.channel) {
    try {
      const channel = interaction.client.channels.cache.get(data.config.vacancies.channel);
      if (channel) {
        const announceEmbed = createVacancyEmbed(vacancy, '🚀 **New Job Opening!**');
        await channel.send({ embeds: [announceEmbed] });
      }
    } catch (error) {
      console.error('Error auto-announcing vacancy:', error);
    }
  }
}

async function handleEditVacancy(interaction, data, saveData) {
  const id = interaction.options.getString('id');
  const vacancy = data.config.vacancies.positions?.[id];
  
  if (!vacancy) {
    await interaction.reply({ 
      content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${id}\``, 
      ephemeral: true 
    });
    return;
  }
  
  // Update fields if provided
  const updates = {};
  const fields = ['title', 'department', 'description', 'requirements', 'salary', 'type', 'location', 'deadline'];
  
  for (const field of fields) {
    const value = interaction.options.getString(field);
    if (value !== null) {
      if (field === 'requirements') {
        updates[field] = value.split(',').map(req => req.trim());
      } else {
        updates[field] = value;
      }
    }
  }
  
  // Update vacancy
  Object.assign(vacancy, updates);
  vacancy.updatedAt = new Date().toISOString();
  vacancy.updatedBy = interaction.user.id;
  
  // Save to database
  await saveData();
  
  // Create embed for confirmation
  const embed = createVacancyEmbed(vacancy, '✏️ **Vacancy Updated Successfully!**');
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDeleteVacancy(interaction, data, saveData) {
  const id = interaction.options.getString('id');
  const vacancy = data.config.vacancies.positions?.[id];
  
  if (!vacancy) {
    await interaction.reply({ 
      content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${id}\``, 
      ephemeral: true 
    });
    return;
  }
  
  // Delete vacancy
  delete data.config.vacancies.positions[id];
  
  // Save to database
  await saveData();
  
  await interaction.reply({ 
    content: `🗑️ **Vacancy Deleted Successfully!**\n\n**${vacancy.title}** has been removed from the system.`, 
    ephemeral: true 
  });
}

async function handleListVacancies(interaction, data) {
  const departmentFilter = interaction.options.getString('department');
  const typeFilter = interaction.options.getString('type');
  
  const positions = data.config.vacancies.positions || {};
  let filteredPositions = Object.values(positions);
  
  // Apply filters
  if (departmentFilter) {
    filteredPositions = filteredPositions.filter(pos => 
      pos.department.toLowerCase().includes(departmentFilter.toLowerCase())
    );
  }
  
  if (typeFilter) {
    filteredPositions = filteredPositions.filter(pos => pos.type === typeFilter);
  }
  
  if (filteredPositions.length === 0) {
    const filterText = [departmentFilter, typeFilter].filter(Boolean).join(' and ');
    await interaction.reply({ 
      content: `📭 **No Vacancies Found!**\n\nNo vacancies match the filter: ${filterText || 'No filters applied'}`, 
      ephemeral: true 
    });
    return;
  }
  
  // Sort by creation date (newest first)
  filteredPositions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Create embed
  const embed = {
    color: 0x00ff00,
    title: '📋 **Job Vacancies**',
    description: `Found **${filteredPositions.length}** vacancy(ies)${departmentFilter || typeFilter ? ` matching your filters` : ''}`,
    fields: filteredPositions.slice(0, 10).map(pos => ({
      name: `${pos.title} (${pos.department})`,
      value: `**Type:** ${pos.type} | **Location:** ${pos.location}\n**ID:** \`${pos.id}\`\n**Created:** ${new Date(pos.createdAt).toLocaleDateString()}`,
      inline: false
    })),
    footer: {
      text: filteredPositions.length > 10 ? `Showing 10 of ${filteredPositions.length} vacancies. Use filters to narrow results.` : 'Use /vacancies edit or /vacancies delete with the ID to manage vacancies.'
    },
    timestamp: new Date()
  };
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSetChannel(interaction, data, saveData) {
  const channel = interaction.options.getChannel('channel');
  
  // Ensure vacancies config exists
  if (!data.config.vacancies) {
    data.config.vacancies = {};
  }
  
  data.config.vacancies.channel = channel.id;
  
  // Save to database
  await saveData();
  
  await interaction.reply({ 
    content: `✅ **Vacancy Channel Set!**\n\nJob vacancy announcements will now be posted to ${channel}.`, 
    ephemeral: true 
  });
}

async function handleAnnounceVacancy(interaction, data) {
  const id = interaction.options.getString('id');
  const vacancy = data.config.vacancies.positions?.[id];
  
  if (!vacancy) {
    await interaction.reply({ 
      content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${id}\``, 
      ephemeral: true 
    });
    return;
  }
  
  if (!data.config.vacancies.channel) {
    await interaction.reply({ 
      content: `❌ **No Channel Configured!**\n\nPlease set a vacancy announcement channel first with \`/vacancies setchannel\`.`, 
      ephemeral: true 
    });
    return;
  }
  
  try {
    const channel = interaction.client.channels.cache.get(data.config.vacancies.channel);
    if (!channel) {
      await interaction.reply({ 
        content: `❌ **Channel Not Found!**\n\nThe configured vacancy channel no longer exists. Please set a new one with \`/vacancies setchannel\`.`, 
        ephemeral: true 
      });
      return;
    }
    
    const embed = createVacancyEmbed(vacancy, '🚀 **Job Opening Available!**');
    await channel.send({ embeds: [embed] });
    
    await interaction.reply({ 
      content: `✅ **Vacancy Announced!**\n\nThe vacancy has been posted to ${channel}.`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error('Error announcing vacancy:', error);
    await interaction.reply({ 
      content: `❌ **Announcement Failed!**\n\nCould not post to the configured channel. Please check permissions and try again.`, 
      ephemeral: true 
    });
  }
}

async function handleApplicationsCommand(interaction, data, saveData) {
  const action = interaction.options.getString('action');
  const vacancyId = interaction.options.getString('vacancy_id');
  const applicationId = interaction.options.getString('application_id');
  const newStatus = interaction.options.getString('new_status');

  if (!vacancyId && action !== 'list') {
    await interaction.reply({ content: 'Please provide a vacancy ID for this action.', ephemeral: true });
    return;
  }

  if (action === 'list') {
    await handleListApplications(interaction, data);
  } else if (action === 'view') {
    if (!applicationId) {
      await interaction.reply({ content: 'Please provide an application ID to view.', ephemeral: true });
      return;
    }
    await handleViewApplication(interaction, data, vacancyId, applicationId);
  } else if (action === 'status') {
    if (!applicationId || !newStatus) {
      await interaction.reply({ content: 'Please provide an application ID and a new status.', ephemeral: true });
      return;
    }
    await handleUpdateApplicationStatus(interaction, data, vacancyId, applicationId, newStatus);
  } else {
    await interaction.reply({ content: 'Unknown action for applications.', ephemeral: true });
  }
}

async function handleListApplications(interaction, data) {
  const vacancyId = interaction.options.getString('vacancy_id');
  const departmentFilter = interaction.options.getString('department');
  const typeFilter = interaction.options.getString('type');

  const applications = data.config.vacancies?.applications || {};
  let filteredApplications = Object.values(applications);

  if (vacancyId) {
    filteredApplications = filteredApplications.filter(app => app.vacancyId === vacancyId);
  }

  if (departmentFilter) {
    filteredApplications = filteredApplications.filter(app => 
      app.applicant.roles.some(role => ROLE_NAMES[role].toLowerCase().includes(departmentFilter.toLowerCase()))
    );
  }

  if (typeFilter) {
    filteredApplications = filteredApplications.filter(app => app.applicant.type === typeFilter);
  }

  if (filteredApplications.length === 0) {
    const filterText = [vacancyId, departmentFilter, typeFilter].filter(Boolean).join(' and ');
    await interaction.reply({ 
      content: `📭 **No Applications Found!**\n\nNo applications match the filter: ${filterText || 'No filters applied'}`, 
      ephemeral: true 
    });
    return;
  }

  // Sort by application date (newest first)
  filteredApplications.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

  const embed = {
    color: 0x00ff00,
    title: '📬 **Job Applications**',
    description: `Found **${filteredApplications.length}** application(s)${vacancyId || departmentFilter || typeFilter ? ` matching your filters` : ''}`,
    fields: filteredApplications.slice(0, 10).map(app => ({
      name: `${app.applicant.user.tag} (${ROLE_NAMES[app.applicant.role]})`,
      value: `**Status:** ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}\n**ID:** \`${app.id}\`\n**Applied:** ${new Date(app.appliedAt).toLocaleDateString()}`,
      inline: false
    })),
    footer: {
      text: filteredApplications.length > 10 ? `Showing 10 of ${filteredApplications.length} applications. Use filters to narrow results.` : 'Use /vacancies applications list or /vacancies applications view with the ID to manage applications.'
    },
    timestamp: new Date()
  };

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleViewApplication(interaction, data, vacancyId, applicationId) {
  const vacancy = data.config.vacancies.positions?.[vacancyId];
  const application = data.config.vacancies.applications?.[applicationId];

  if (!vacancy) {
    await interaction.reply({ 
      content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${vacancyId}\``, 
      ephemeral: true 
    });
    return;
  }

  if (!application) {
    await interaction.reply({ 
      content: `❌ **Application Not Found!**\n\nNo application found with ID: \`${applicationId}\``, 
      ephemeral: true 
    });
    return;
  }

  const user = await interaction.client.users.fetch(application.applicant.user.id);
  const roleName = ROLE_NAMES[application.applicant.role];

  let reply = `**Application for ${vacancy.title} (${roleName})**\n\n`;
  reply += `**Applicant:** ${user.tag}\n`;
  reply += `**Status:** ${application.status.charAt(0).toUpperCase() + application.status.slice(1)}\n`;
  reply += `**Applied On:** ${new Date(application.appliedAt).toLocaleDateString()}\n`;
  reply += `**Message:** ${application.message}\n`;

  await interaction.reply({ content: reply, ephemeral: true });
}

async function handleUpdateApplicationStatus(interaction, data, vacancyId, applicationId, newStatus) {
  const vacancy = data.config.vacancies.positions?.[vacancyId];
  const application = data.config.vacancies.applications?.[applicationId];

  if (!vacancy) {
    await interaction.reply({ 
      content: `❌ **Vacancy Not Found!**\n\nNo vacancy found with ID: \`${vacancyId}\``, 
      ephemeral: true 
    });
    return;
  }

  if (!application) {
    await interaction.reply({ 
      content: `❌ **Application Not Found!**\n\nNo application found with ID: \`${applicationId}\``, 
      ephemeral: true 
    });
    return;
  }

  if (!['review', 'interview', 'accepted', 'rejected', 'withdrawn'].includes(newStatus)) {
    await interaction.reply({ content: 'Invalid status provided. Please use one of: review, interview, accepted, rejected, withdrawn.', ephemeral: true });
    return;
  }

  application.status = newStatus;
  application.updatedAt = new Date().toISOString();
  application.updatedBy = interaction.user.id;

  await saveData();

  await interaction.reply({ 
    content: `✅ Application status updated to \`${newStatus}\` for vacancy \`${vacancy.title}\` (ID: \`${applicationId}\`).`, 
    ephemeral: true 
  });
}

function createVacancyEmbed(vacancy, title) {
  // Determine color based on vacancy status or type
  let color = 0x0099ff; // Default blue
  if (vacancy.status === 'closed') color = 0xff0000; // Red for closed
  else if (vacancy.type === 'full-time') color = 0x00ff00; // Green for full-time
  else if (vacancy.type === 'part-time') color = 0xffff00; // Yellow for part-time
  else if (vacancy.type === 'contract') color = 0xff6600; // Orange for contract
  else if (vacancy.type === 'internship') color = 0x9933ff; // Purple for internship

  // Format requirements as a clean list
  const requirementsList = vacancy.requirements 
    ? vacancy.requirements.map(req => `• ${req.trim()}`).join('\n')
    : 'No specific requirements listed';

  // Calculate days until deadline
  let deadlineInfo = 'No deadline set';
  if (vacancy.deadline) {
    const deadline = new Date(vacancy.deadline);
    const today = new Date();
    const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
      deadlineInfo = `❌ **Closed** (Deadline passed)`;
      color = 0xff0000; // Red for expired
    } else if (daysLeft === 0) {
      deadlineInfo = `⚠️ **Today!** (Last day to apply)`;
      color = 0xff6600; // Orange for urgent
    } else if (daysLeft <= 3) {
      deadlineInfo = `🔥 **${daysLeft} day${daysLeft > 1 ? 's' : ''} left** (Apply soon!)`;
      color = 0xff6600; // Orange for urgent
    } else if (daysLeft <= 7) {
      deadlineInfo = `⏰ **${daysLeft} days left**`;
    } else {
      deadlineInfo = `📅 **${daysLeft} days left**`;
    }
  }

  // Format salary with currency symbol
  const salaryDisplay = vacancy.salary ? `💰 **${vacancy.salary}**` : '💼 **Competitive salary**';

  // Create status badge
  const statusBadge = vacancy.status === 'active' ? '🟢 **Active**' : '🔴 **Closed**';

  const embed = {
    color: color,
    title: `🎯 ${title || 'Job Vacancy'}`,
    description: vacancy.description || 'No description provided.',
    fields: [
      {
        name: '🏢 **Department**',
        value: `\`${vacancy.department}\``,
        inline: true
      },
      {
        name: '📋 **Employment Type**',
        value: `\`${vacancy.type.charAt(0).toUpperCase() + vacancy.type.slice(1)}\``,
        inline: true
      },
      {
        name: '📍 **Location**',
        value: `\`${vacancy.location.charAt(0).toUpperCase() + vacancy.location.slice(1)}\``,
        inline: true
      },
      {
        name: '💵 **Salary**',
        value: salaryDisplay,
        inline: true
      },
      {
        name: '⏰ **Deadline**',
        value: deadlineInfo,
        inline: true
      },
      {
        name: '📊 **Status**',
        value: statusBadge,
        inline: true
      },
      {
        name: '📝 **Requirements**',
        value: requirementsList,
        inline: false
      }
    ],
    footer: {
      text: `Vacancy ID: ${vacancy.id} • Created: ${new Date(vacancy.createdAt).toLocaleDateString()}`
    },
    timestamp: new Date(),
    thumbnail: {
      url: 'https://cdn.discordapp.com/emojis/1234567890.png' // You can replace with your server's icon
    }
  };

  // Add application button if vacancy is active
  if (vacancy.status === 'active') {
    embed.description += '\n\n**Ready to apply?** Use `/apply ${vacancy.id}` to submit your application!';
  }

  return embed;
}

// Helper function to create jobs embed with pagination
function createJobsEmbed(positions, currentPage, totalPages, positionsPerPage, departmentFilter, typeFilter, locationFilter) {
  const startIndex = (currentPage - 1) * positionsPerPage;
  const endIndex = startIndex + positionsPerPage;
  const pagePositions = positions.slice(startIndex, endIndex);
  
  // Determine color based on number of positions
  let color = 0x00ff00; // Green for many positions
  if (positions.length <= 3) color = 0xffff00; // Yellow for few positions
  if (positions.length === 0) color = 0xff0000; // Red for no positions
  
  const embed = {
    color: color,
    title: '💼 **Available Job Openings**',
    description: `Found **${positions.length}** open position(s)${[departmentFilter, typeFilter, locationFilter].filter(Boolean).length > 0 ? ` matching your criteria` : ''}`,
    fields: pagePositions.map(pos => ({
      name: `🏢 ${pos.title}`,
      value: `**Department:** ${pos.department}\n**Type:** ${pos.type.charAt(0).toUpperCase() + pos.type.slice(1)} | **Location:** ${pos.location.charAt(0).toUpperCase() + pos.location.slice(1)}\n**Salary:** ${pos.salary || 'Competitive'}\n**ID:** \`${pos.id}\`${pos.deadline ? `\n**Deadline:** ${new Date(pos.deadline).toLocaleDateString()}` : ''}`,
      inline: false
    })),
    footer: {
      text: totalPages > 1 ? `Page ${currentPage} of ${totalPages} • ${positions.length} total positions` : `${positions.length} position(s) found`
    },
    timestamp: new Date()
  };
  
  // Add application instructions
  if (pagePositions.length > 0) {
    embed.description += '\n\n**💡 How to Apply:** Use `/apply <vacancy_id>` with the ID shown above to submit your application!';
  }
  
  return embed;
}

// Helper function to create pagination buttons for jobs
function createJobsPaginationButtons(currentPage, totalPages, positions, departmentFilter, typeFilter, locationFilter) {
  const row = new ActionRowBuilder();
  
  // Previous page button
  const prevButton = new ButtonBuilder()
    .setCustomId(`jobs_page_${currentPage - 1}_${departmentFilter || 'none'}_${typeFilter || 'none'}_${locationFilter || 'none'}`)
    .setLabel('◀️ Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);
  
  // Page indicator
  const pageButton = new ButtonBuilder()
    .setCustomId('jobs_page_info')
    .setLabel(`Page ${currentPage} of ${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);
  
  // Next page button
  const nextButton = new ButtonBuilder()
    .setCustomId(`jobs_page_${currentPage + 1}_${departmentFilter || 'none'}_${typeFilter || 'none'}_${locationFilter || 'none'}`)
    .setLabel('Next ▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);
  
  row.addComponents(prevButton, pageButton, nextButton);
  return [row];
}

// Leadership command helper functions
async function handleLeadershipDashboard(interaction, data) {
  // Calculate key metrics
  const totalStaff = Object.keys(data.userStatus).length;
  const activeTraining = Object.keys(data.userTrainingProgress).length;
  const activeQuizzes = Object.keys(data.userQuizProgress).length;
  const totalVacancies = Object.keys(data.config.vacancies?.positions || {}).length;
  const activeVacancies = Object.values(data.config.vacancies?.positions || {}).filter(v => v.status === 'active').length;
  const totalApplications = Object.keys(data.config.vacancies?.applications || {}).length;
  
  // Calculate training completion rates
  const trainingStats = {};
  for (const roleId of Object.keys(ROLE_IDS)) {
    const roleName = ROLE_NAMES[ROLE_IDS[roleId]];
    const totalForRole = Object.values(data.userStatus).filter(user => user[roleId]).length;
    const completedForRole = Object.values(data.userStatus).filter(user => user[roleId] && user[roleId].completed).length;
    trainingStats[roleName] = {
      total: totalForRole,
      completed: completedForRole,
      rate: totalForRole > 0 ? Math.round((completedForRole / totalForRole) * 100) : 0
    };
  }
  
  const embed = {
    color: 0x0099ff,
    title: '📊 **Leadership Dashboard**',
    description: 'Key metrics and overview of your server operations',
    fields: [
      {
        name: '👥 **Staff Overview**',
        value: `**Total Staff:** ${totalStaff}\n**Active Training:** ${activeTraining}\n**Active Quizzes:** ${activeQuizzes}`,
        inline: true
      },
      {
        name: '💼 **Job Vacancies**',
        value: `**Total Positions:** ${totalVacancies}\n**Active Openings:** ${activeVacancies}\n**Applications:** ${totalApplications}`,
        inline: true
      },
      {
        name: '📈 **Training Completion Rates**',
        value: Object.entries(trainingStats).map(([role, stats]) => 
          `${role}: **${stats.rate}%** (${stats.completed}/${stats.total})`
        ).join('\n'),
        inline: false
      }
    ],
    footer: {
      text: 'Use /leadership analytics for detailed reports'
    },
    timestamp: new Date()
  };
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeadershipAnalytics(interaction, data) {
  const type = interaction.options.getString('type');
  const period = interaction.options.getString('period') || '30d';
  
  let embed;
  
  switch (type) {
    case 'training':
      embed = await createTrainingAnalyticsEmbed(data, period);
      break;
    case 'quizzes':
      embed = await createQuizAnalyticsEmbed(data, period);
      break;
    case 'applications':
      embed = await createApplicationAnalyticsEmbed(data, period);
      break;
    case 'activity':
      embed = await createActivityAnalyticsEmbed(data, period);
      break;
    default:
      await interaction.reply({ content: 'Invalid analytics type.', ephemeral: true });
      return;
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeadershipStaff(interaction, data, saveData) {
  const action = interaction.options.getString('action');
  const user = interaction.options.getUser('user');
  const newRole = interaction.options.getString('new_role');
  
  if (action === 'list') {
    await handleListAllStaff(interaction, data);
  } else if (action === 'view') {
    if (!user) {
      await interaction.reply({ content: 'Please specify a user to view.', ephemeral: true });
      return;
    }
    await handleViewStaffMember(interaction, data, user);
  } else if (action === 'update') {
    if (!user || !newRole) {
      await interaction.reply({ content: 'Please specify both a user and a new role.', ephemeral: true });
      return;
    }
    await handleUpdateStaffRole(interaction, data, saveData, user, newRole);
  }
}

async function handleLeadershipReports(interaction, data) {
  const reportType = interaction.options.getString('report_type');
  const format = interaction.options.getString('format') || 'embed';
  
  let report;
  
  switch (reportType) {
    case 'training':
      report = await generateTrainingReport(data, format);
      break;
    case 'quizzes':
      report = await generateQuizReport(data, format);
      break;
    case 'vacancies':
      report = await generateVacancyReport(data, format);
      break;
    case 'performance':
      report = await generatePerformanceReport(data, format);
      break;
    default:
      await interaction.reply({ content: 'Invalid report type.', ephemeral: true });
      return;
  }
  
  if (format === 'text') {
    await interaction.reply({ content: report, ephemeral: true });
  } else {
    await interaction.reply({ embeds: [report], ephemeral: true });
  }
}

// Helper functions for analytics and reports
async function createTrainingAnalyticsEmbed(data, period) {
  const totalUsers = Object.keys(data.userStatus).length;
  const activeTraining = Object.keys(data.userTrainingProgress).length;
  
  const embed = {
    color: 0x00ff00,
    title: '📚 **Training Analytics**',
    description: `Training progress overview for ${period}`,
    fields: [
      {
        name: '📊 **Overview**',
        value: `**Total Users:** ${totalUsers}\n**Active Training:** ${activeTraining}\n**Completion Rate:** ${totalUsers > 0 ? Math.round((activeTraining / totalUsers) * 100) : 0}%`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
  
  return embed;
}

async function createQuizAnalyticsEmbed(data, period) {
  const totalQuizzes = Object.keys(data.userQuizProgress).length;
  const totalQuestions = Object.values(data.config.quizzes).reduce((sum, quiz) => sum + (quiz?.length || 0), 0);
  
  const embed = {
    color: 0xffff00,
    title: '🧠 **Quiz Analytics**',
    description: `Quiz performance overview for ${period}`,
    fields: [
      {
        name: '📊 **Overview**',
        value: `**Active Quizzes:** ${totalQuizzes}\n**Total Questions:** ${totalQuestions}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
  
  return embed;
}

async function createApplicationAnalyticsEmbed(data, period) {
  const applications = data.config.vacancies?.applications || {};
  const totalApplications = Object.keys(applications).length;
  const pendingApplications = Object.values(applications).filter(app => app.status === 'pending').length;
  const acceptedApplications = Object.values(applications).filter(app => app.status === 'accepted').length;
  
  const embed = {
    color: 0x0099ff,
    title: '📬 **Application Analytics**',
    description: `Job application overview for ${period}`,
    fields: [
      {
        name: '📊 **Overview**',
        value: `**Total Applications:** ${totalApplications}\n**Pending Review:** ${pendingApplications}\n**Accepted:** ${acceptedApplications}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
  
  return embed;
}

async function createActivityAnalyticsEmbed(data, period) {
  const totalStaff = Object.keys(data.userStatus).length;
  const activeRoles = Object.values(data.userStatus).reduce((sum, user) => {
    return sum + Object.values(user).filter(status => status?.completed).length;
  }, 0);
  
  const embed = {
    color: 0xff6600,
    title: '🏃 **Staff Activity Analytics**',
    description: `Staff activity overview for ${period}`,
    fields: [
      {
        name: '📊 **Overview**',
        value: `**Total Staff:** ${totalStaff}\n**Completed Roles:** ${activeRoles}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
  
  return embed;
}

async function handleListAllStaff(interaction, data) {
  const staffMembers = Object.entries(data.userStatus).map(([userId, status]) => {
    const roles = Object.entries(status).filter(([roleId, roleStatus]) => roleStatus?.completed);
    return {
      userId,
      roles: roles.map(([roleId]) => ROLE_NAMES[roleId]).join(', '),
      completedCount: roles.length
    };
  });
  
  staffMembers.sort((a, b) => b.completedCount - a.completedCount);
  
  const embed = {
    color: 0x0099ff,
    title: '👥 **All Staff Members**',
    description: `Total staff: **${staffMembers.length}**`,
    fields: staffMembers.slice(0, 10).map(member => ({
      name: `<@${member.userId}>`,
      value: `**Roles:** ${member.roles || 'None'}\n**Completed:** ${member.completedCount}`,
      inline: true
    })),
    footer: {
      text: staffMembers.length > 10 ? `Showing 10 of ${staffMembers.length} staff members` : 'All staff members shown'
    },
    timestamp: new Date()
  };
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleViewStaffMember(interaction, data, user) {
  const userStatus = data.userStatus[user.id] || {};
  const completedRoles = Object.entries(userStatus).filter(([roleId, status]) => status?.completed);
  const currentTraining = data.userTrainingProgress[user.id];
  const currentQuiz = data.userQuizProgress[user.id];
  
  const embed = {
    color: 0x00ff00,
    title: `👤 **Staff Member: ${user.tag}**`,
    fields: [
      {
        name: '✅ **Completed Roles**',
        value: completedRoles.length > 0 ? completedRoles.map(([roleId]) => ROLE_NAMES[roleId]).join('\n') : 'No roles completed',
        inline: false
      },
      {
        name: '📚 **Current Training**',
        value: currentTraining ? `Training for: ${ROLE_NAMES[currentTraining.role]} (Step ${currentTraining.step})` : 'No active training',
        inline: false
      },
      {
        name: '🧠 **Current Quiz**',
        value: currentQuiz ? `Quiz for: ${ROLE_NAMES[currentQuiz.role]} (Question ${currentQuiz.q + 1}/${currentQuiz.correct + currentQuiz.incorrect})` : 'No active quiz',
        inline: false
      }
    ],
    timestamp: new Date()
  };
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUpdateStaffRole(interaction, data, saveData, user, newRole) {
  // This would typically involve Discord API calls to update roles
  // For now, we'll just acknowledge the request
  
  const roleName = ROLE_NAMES[newRole];
  
  await interaction.reply({ 
    content: `✅ **Role Update Requested!**\n\nUser: ${user.tag}\nNew Role: ${roleName}\n\n**Note:** This command requests a role update. You may need to manually assign the role in Discord server settings.`, 
    ephemeral: true 
  });
}

// Report generation functions
async function generateTrainingReport(data, format) {
  const totalUsers = Object.keys(data.userStatus).length;
  const activeTraining = Object.keys(data.userTrainingProgress).length;
  
  if (format === 'text') {
    return `📚 **Training Report**\n\nTotal Users: ${totalUsers}\nActive Training: ${activeTraining}\nCompletion Rate: ${totalUsers > 0 ? Math.round((activeTraining / totalUsers) * 100) : 0}%`;
  }
  
  return {
    color: 0x00ff00,
    title: '📚 **Training Report**',
    fields: [
      {
        name: '📊 **Summary**',
        value: `**Total Users:** ${totalUsers}\n**Active Training:** ${activeTraining}\n**Completion Rate:** ${totalUsers > 0 ? Math.round((activeTraining / totalUsers) * 100) : 0}%`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
}

async function generateQuizReport(data, format) {
  const totalQuizzes = Object.keys(data.userQuizProgress).length;
  
  if (format === 'text') {
    return `🧠 **Quiz Report**\n\nActive Quizzes: ${totalQuizzes}`;
  }
  
  return {
    color: 0xffff00,
    title: '🧠 **Quiz Report**',
    fields: [
      {
        name: '📊 **Summary**',
        value: `**Active Quizzes:** ${totalQuizzes}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
}

async function generateVacancyReport(data, format) {
  const positions = data.config.vacancies?.positions || {};
  const applications = data.config.vacancies?.applications || {};
  
  if (format === 'text') {
    return `💼 **Vacancy Report**\n\nTotal Positions: ${Object.keys(positions).length}\nActive Positions: ${Object.values(positions).filter(v => v.status === 'active').length}\nTotal Applications: ${Object.keys(applications).length}`;
  }
  
  return {
    color: 0x0099ff,
    title: '💼 **Vacancy Report**',
    fields: [
      {
        name: '📊 **Summary**',
        value: `**Total Positions:** ${Object.keys(positions).length}\n**Active Positions:** ${Object.values(positions).filter(v => v.status === 'active').length}\n**Total Applications:** ${Object.keys(applications).length}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
}

async function generatePerformanceReport(data, format) {
  const totalStaff = Object.keys(data.userStatus).length;
  
  if (format === 'text') {
    return `🏃 **Performance Report**\n\nTotal Staff: ${totalStaff}`;
  }
  
  return {
    color: 0xff6600,
    title: '🏃 **Performance Report**',
    fields: [
      {
        name: '📊 **Summary**',
        value: `**Total Staff:** ${totalStaff}`,
        inline: false
      }
    ],
    timestamp: new Date()
  };
}

module.exports.sendOnboardingStep = sendOnboardingStep;
module.exports.sendQuizStep = sendQuizStep;
module.exports.sendBranchingScenario = sendBranchingScenario; 
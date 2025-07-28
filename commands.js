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
      if (!data.config.quizzes[role]) {
        console.error('Quiz role not found:', role, 'Available:', Object.keys(data.config.quizzes));
        await interaction.reply({ content: `Role not found. (role: '${role}')`, ephemeral: true });
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
          for (const guild of client.guilds.cache.values()) {
            try {
              console.log('Role assignment - checking guild:', guild.name);
              const member = await guild.members.fetch(user.id).catch(() => null);
              if (member) {
                console.log('Role assignment - member found, has role:', member.roles.cache.has(XD_CERTIFIED_ROLE_ID));
                if (!member.roles.cache.has(XD_CERTIFIED_ROLE_ID)) {
                  await member.roles.add(XD_CERTIFIED_ROLE_ID);
                  console.log('Role assignment - role added successfully');
                  await user.send('You have been given the **XD Certified** role on the server!');
                  break; // Only assign once
                } else {
                  console.log('Role assignment - user already has the role');
                  await user.send('You already have the **XD Certified** role!');
                }
              } else {
                console.log('Role assignment - member not found in guild:', guild.name);
              }
            } catch (e) {
              console.error('Error assigning role in guild:', guild.name, e);
            }
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

module.exports.sendOnboardingStep = sendOnboardingStep;
module.exports.sendQuizStep = sendQuizStep;
module.exports.sendBranchingScenario = sendBranchingScenario;

// Button interaction handler (to be added in index.js):
// client.on('interactionCreate', async interaction => {
//   if (interaction.isButton() && interaction.customId === 'onboarding_next') {
//     const { data, saveData } = ... // get from context or global
//     if (!data.userTrainingProgress[interaction.user.id]) return;
//     data.userTrainingProgress[interaction.user.id].step++;
//     await sendOnboardingStep(interaction.user, data, saveData);
//     await interaction.deferUpdate();
//   }
// }); 
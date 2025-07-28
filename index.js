require('dotenv').config();

// Debug: Check if environment variables are loaded
console.log('Environment check:');
console.log('DISCORD_TOKEN exists:', !!process.env.DISCORD_TOKEN);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { initializeDatabase, data, saveData, loadUserDataFromDB, saveUserDataToDB, ROLE_IDS, ROLE_NAMES } = require('./data');
const { sendOnboardingStep, sendQuizStep } = require('./commands');

// Initialize database connection
async function initializeBot() {
  try {
    await initializeDatabase();
    console.log('After database initialization - quiz keys:', Object.keys(data.config.quizzes));
    console.log('After database initialization - onboarding keys:', Object.keys(data.config.onboarding));
    console.log('Data config structure:', JSON.stringify(data.config, null, 2));
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.commands = new Collection();
const commandFiles = ['./commands.js'];
for (const file of commandFiles) {
  const commands = require(file);
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
}

client.once('ready', async () => {
  // Initialize database
  await initializeBot();
  
  // Register slash commands for all guilds (for demo; for production, use application/global commands)
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(client.commands.map(cmd => cmd.data));
  }
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === 'onboarding_next') {
      if (!data.userTrainingProgress[interaction.user.id]) return;
      data.userTrainingProgress[interaction.user.id].step++;
      // Disable the previous button
      if (interaction.message && interaction.message.editable) {
        const row = interaction.message.components[0];
        if (row) {
          const disabledRow = new ActionRowBuilder().addComponents(
            ButtonBuilder.from(row.components[0]).setDisabled(true)
          );
          await interaction.message.edit({ components: [disabledRow] });
        }
      }
      await sendOnboardingStep(interaction.user, data, saveData, interaction);
      await interaction.deferUpdate();
      return;
    } else if (interaction.customId.startsWith('scenario_')) {
      // Handle branching scenario button clicks
      const { sendBranchingScenario } = require('./commands.js');
      const { BRANCHING_SCENARIOS, ROLE_NAMES } = require('./data.js');
      
      const parts = interaction.customId.split('_');
      const role = parts[1];
      const scenarioKey = parts[2];
      const optionKey = parts[3];
      
      const scenario = BRANCHING_SCENARIOS[role]?.[scenarioKey];
      if (!scenario) return;
      
      const option = scenario.options[optionKey];
      if (!option) return;
      
      // Send the feedback
      await interaction.reply({ content: option.followUp, ephemeral: true });
      
      // Disable the buttons
      const row = new ActionRowBuilder();
      for (const [key, opt] of Object.entries(scenario.options)) {
        const button = ButtonBuilder.from(interaction.message.components[0].components.find(b => b.customId === `scenario_${role}_${scenarioKey}_${key}`));
        button.setDisabled(true);
        row.addComponents(button);
      }
      
      await interaction.message.edit({ components: [row] });
      
      // Send next scenario if available
      const scenarioKeys = Object.keys(BRANCHING_SCENARIOS[role]);
      const currentIndex = scenarioKeys.indexOf(scenarioKey);
      if (currentIndex < scenarioKeys.length - 1) {
        const nextScenarioKey = scenarioKeys[currentIndex + 1];
        const nextScenario = BRANCHING_SCENARIOS[role][nextScenarioKey];
        await sendBranchingScenario(interaction.user, role, nextScenarioKey, nextScenario, data, saveData, interaction);
      } else {
        // All scenarios completed
        await interaction.user.send('🎉 **Branching scenarios completed!** You\'ve demonstrated good decision-making skills.');
      }
      return;
    }
  }
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, { client, data, saveData });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
  }
});

// Handle text messages in DMs for quiz answers
client.on('messageCreate', async message => {
  // Only handle DMs and messages from users (not bots)
  if (message.author.bot || message.channel.type !== 1) return; // 1 = DM
  
  const progress = data.userQuizProgress[message.author.id];
  if (!progress) return; // No quiz in progress
  
  const quiz = data.config.quizzes[progress.role];
  const question = quiz[progress.q];
  
  // Check if the user's answer matches the expected answer
  const userAnswer = message.content.toLowerCase().trim();
  const expectedAnswer = question.a.toLowerCase().trim();
  
  // Simple matching - check if user's answer contains the expected answer or vice versa
  const isCorrect = userAnswer.includes(expectedAnswer) || expectedAnswer.includes(userAnswer);
  
  if (isCorrect) {
    progress.correct++;
    await message.reply('✅ Correct!');
  } else {
    await message.reply(`❌ Incorrect. The correct answer was: **${question.a}**`);
  }
  
  progress.q++;
  await sendQuizStep(message.author, data, saveData, { client: client });
});

client.login(process.env.DISCORD_TOKEN); 
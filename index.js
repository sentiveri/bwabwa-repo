require('dotenv').config();
const { REST, Routes, Client, GatewayIntentBits, Partials, Collection, ActivityType, PresenceUpdateStatus, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const { SUPABASE_URL, SUPABASE_KEY, BOT_TOKEN, CLIENT_ID } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY || !BOT_TOKEN || !CLIENT_ID) {
  console.error('Missing required environment variables (SUPABASE_URL, SUPABASE_KEY, BOT_TOKEN, or CLIENT_ID) in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
  ],
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

const deployCommands = async () => {
  try {
    const commands = [];
    for (const command of client.commands.values()) {
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    console.log(`Started refreshing ${commands.length} application slash commands globally.`);

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log('Successfully reloaded all commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
};

client.once(Events.ClientReady, async () => {
  console.log(`Ready, logged in as ${client.user.tag}`);

  try {
    const { data, error } = await supabase.from('profiles').select('id', { count: 'exact' });
    if (error) throw error;
    console.log(`Connected to Supabase, found ${data.length} profiles`);
  } catch (err) {
    console.error('Supabase connection error:', err.message);
  }

  await deployCommands();
  console.log(`Commands deployed globally.`);

  const statusType = process.env.BOT_STATUS || 'online';
  const activityType = process.env.ACTIVITY_TYPE || 'PLAYING';
  const activityName = process.env.ACTIVITY_NAME || 'Discord'; 

  const activityTypeMap = {
    'PLAYING': ActivityType.Playing,
    'WATCHING': ActivityType.Watching,
    'LISTENING': ActivityType.Listening,
    'STREAMING': ActivityType.Streaming,
    'COMPETING': ActivityType.Competing,
  };

  const statusMap = {
    'online': PresenceUpdateStatus.Online,
    'idle': PresenceUpdateStatus.Idle,
    'dnd': PresenceUpdateStatus.DoNotDisturb,
    'invisible': PresenceUpdateStatus.Invisible,
  };

  client.user.setPresence({
    status: statusMap[statusType] || PresenceUpdateStatus.Online,
    activities: [{ name: activityName, type: activityTypeMap[activityType] || ActivityType.Playing }],
  });

  console.log(`Bot status set to: ${statusType}`);
  console.log(`Activity set to: ${activityType} ${activityName}`);
});

client.triggers = [];

const triggersPath = path.join(__dirname, 'triggers');
if (fs.existsSync(triggersPath)) {
  const triggerFiles = fs.readdirSync(triggersPath).filter(file => file.endsWith('.js'));
  for (const file of triggerFiles) {
    const trigger = require(path.join(triggersPath, file));
    if ('triggers' in trigger && 'execute' in trigger) {
      client.triggers.push(trigger);
    } else {
      console.log(`[WARNING] The trigger at ${file} is missing "triggers" or "execute".`);
    }
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
    }
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  for (const trigger of client.triggers) {
    if (trigger.triggers.some(t => content.includes(t.toLowerCase()))) {
      try {
        await trigger.execute(message);
      } catch (err) {
        console.error(`Error executing trigger ${trigger.name}:`, err);
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
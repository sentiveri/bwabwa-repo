require('dotenv').config();
const { REST, Routes, Client, GatewayIntentBits, Partials, Collection, ActivityType, PresenceUpdateStatus, Events } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crosspost = require('./utils/msgrelay');
const path = require('path');
const express = require("express");

const app = express();
app.get("/", (req, res) => {
  res.send("Bot is alive and running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

const { SUPABASE_URL, SUPABASE_KEY, BOT_TOKEN, CLIENT_ID } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY || !BOT_TOKEN || !CLIENT_ID) {
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

client.relayEnabled = true;
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

const deployCommands = async () => {
  try {
    const commands = [];
    for (const command of client.commands.values()) {
      commands.push(command.data.toJSON());
    }
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Commands deployed.');
  } catch (error) {
    console.error(error);
  }
};

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await deployCommands();

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
});

client.triggers = [];
const triggersPath = path.join(__dirname, 'triggers');
if (fs.existsSync(triggersPath)) {
  const triggerFiles = fs.readdirSync(triggersPath).filter(file => file.endsWith('.js'));
  for (const file of triggerFiles) {
    const trigger = require(path.join(triggersPath, file));
    if ('triggers' in trigger && 'execute' in trigger) {
      client.triggers.push(trigger);
    }
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'Error executing command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'Error executing command.', ephemeral: true });
    }
  }
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot && !message.webhookId) return;

  if (client.relayEnabled) {
    if (message.channel.id === process.env.SOURCE1) {
      try {
        await crosspost(message);
      } catch (err) {
        console.error(err);
      }
    }
  }

  let contentToScan = message.content.toLowerCase();

  if (message.embeds.length > 0) {
    message.embeds.forEach(embed => {
      if (embed.title) contentToScan += " " + embed.title.toLowerCase();
      if (embed.description) contentToScan += " " + embed.description.toLowerCase();
      if (embed.fields) {
        embed.fields.forEach(field => {
          contentToScan += " " + field.name.toLowerCase() + " " + field.value.toLowerCase();
        });
      }
    });
  }

  const TRIGGER_CHANNELS = [process.env.TRIGGER_CHANNEL_1, process.env.TRIGGER_CHANNEL_2];

  for (const trigger of client.triggers) {
    if (!TRIGGER_CHANNELS.includes(message.channel.id)) continue; // skip other channels
    if (trigger.triggers.some(t => contentToScan.includes(t.toLowerCase()))) {
      await trigger.execute(message);
    }
  }
});

client.login(BOT_TOKEN);
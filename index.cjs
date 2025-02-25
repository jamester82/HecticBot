const { Client, Collection, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { BOT_TOKEN, clientId } = require('./config.json');
const fs = require('fs');
const path = require('path');

// Paths for various JSON data files
const afkFilePath = path.join(__dirname, 'db', 'afk.json');
const filterSettingsPath = path.join(__dirname, 'db', 'filter_settings.json');
const blacklistPath = path.join(__dirname, 'blacklist.json');
const whitelistPath = path.join(__dirname, 'whitelist.json');
const applicationsFilePath = path.join(__dirname, 'db', 'applications.json');
const configPath = path.join(__dirname, 'db', 'application_channels.json');
const ticketSettingsFilePath = path.join(__dirname, 'db', 'ticket_settings.json');
const settingsFilePath = path.join(__dirname, 'db', 'welcome_goodbye_settings.json');
const chatSettingsPath = path.join(__dirname, 'db', 'chat_settings.json');

// Ensure necessary files exist
const ensureFileExists = (filePath, defaultData) => {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
};
ensureFileExists(afkFilePath, {});
ensureFileExists(filterSettingsPath, { swearwords: true, links: true, spam: true });
ensureFileExists(blacklistPath, []);
ensureFileExists(whitelistPath, []);
ensureFileExists(applicationsFilePath, []);
ensureFileExists(configPath, {});
ensureFileExists(ticketSettingsFilePath, {});
ensureFileExists(settingsFilePath, {});
ensureFileExists(chatSettingsPath, {});

// Helper functions for reading/writing JSON files
const loadJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const saveJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

// Load and save welcome/goodbye settings
let welcomeGoodbyeSettings = loadJson(settingsFilePath);
const loadGuildSettings = (guildId) => {
    if (!welcomeGoodbyeSettings[guildId]) {
        welcomeGoodbyeSettings[guildId] = {
            welcomeChannel: null,
            goodbyeChannel: null,
            customWelcomeMessage: null,
            customGoodbyeMessage: null,
        };
    }
    return welcomeGoodbyeSettings[guildId];
};
const saveSettings = () => saveJson(settingsFilePath, welcomeGoodbyeSettings);

// Functions for sending welcome/goodbye messages
async function sendWelcomeMessage(member) {
    const guildSettings = loadGuildSettings(member.guild.id);
    if (!guildSettings.welcomeChannel) return;

    const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcomeChannel);
    if (!welcomeChannel) return;

    let message = guildSettings.customWelcomeMessage || `Welcome to ${member.guild.name}, <@${member.id}>!`;
    message = message.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name);
    await welcomeChannel.send(message);
}

async function sendGoodbyeMessage(member) {
    const guildSettings = loadGuildSettings(member.guild.id);
    if (!guildSettings.goodbyeChannel) return;

    const goodbyeChannel = member.guild.channels.cache.get(guildSettings.goodbyeChannel);
    if (!goodbyeChannel) return;

    let message = guildSettings.customGoodbyeMessage || `Goodbye from ${member.guild.name}, <@${member.id}>. We hope to see you again!`;
    message = message.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name);
    await goodbyeChannel.send(message);
}

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
});

client.commands = new Collection();
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.cjs') || file.endsWith('.js'));

// Load commands from files
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
    } else {
        console.warn(`[WARNING] The command at ./commands/${file} is missing "data" or "execute" property.`);
    }
}

// Initialize REST and deploy commands
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
(async () => {
    try {
        console.log('Refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();

// Handle member join/leave for welcome/goodbye messages
client.on('guildMemberAdd', async (member) => {
    console.log(`Member ${member.user.username} joined.`);
    await sendWelcomeMessage(member);
});

client.on('guildMemberRemove', async (member) => {
    console.log(`Member ${member.user.username} left.`);
    await sendGoodbyeMessage(member);
});

// Handle interactions (commands, buttons, modals)
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            await interaction.reply({ content: 'Error executing command!', ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const command = client.commands.get('setup-ticket');
        if (interaction.customId === 'create-ticket' || interaction.customId === 'close-ticket') {
            try {
                await command.handleButtonInteraction(interaction);
            } catch (error) {
                console.error('Error handling button interaction:', error);
                await interaction.reply({ content: 'There was an error handling this interaction.', ephemeral: true });
            }
        }

        const [action, roleId] = interaction.customId.split('_');
        if (action === 'toggle') {
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) return interaction.reply({ content: 'Role not found.', ephemeral: true });
            const member = interaction.member;
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                await interaction.reply({ content: `The ${role.name} role has been removed from you.`, ephemeral: true });
            } else {
                await member.roles.add(role);
                await interaction.reply({ content: `You have been given the ${role.name} role!`, ephemeral: true });
            }
        }

        if (interaction.customId === 'apply_button') {
            const modal = new ModalBuilder()
                .setCustomId('resume_modal')
                .setTitle('Staff Application Form');

            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nameInput').setLabel('Your Name').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ageInput').setLabel('Your Age').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('experienceInput').setLabel('Experience').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reasonInput').setLabel('Why Join the Team?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roleInput').setLabel('Desired Role').setStyle(TextInputStyle.Short).setRequired(true))
            );

            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'resume_modal') {
        const application = {
            name: interaction.fields.getTextInputValue('nameInput'),
            age: interaction.fields.getTextInputValue('ageInput'),
            experience: interaction.fields.getTextInputValue('experienceInput'),
            reason: interaction.fields.getTextInputValue('reasonInput'),
            role: interaction.fields.getTextInputValue('roleInput')
        };

        saveJson(applicationsFilePath, [...loadJson(applicationsFilePath), application]);
        await interaction.reply({ content: 'Your application has been submitted.', ephemeral: true });
    }
});

// Expanded Chatbot responses with affirmations, inspiration, and playful personality
const responses = {
    hello: ["Hello! How can I assist you?", "Hi there!", "Hey! What's up?", "Hello! How's your day going?", "Hi! Nice to see you!", "Hi! How’s it going?"],
    hi: ["Hello! How can I assist you?", "Hi there!", "Hey! What's up?", "Hello! How's your day going?", "Hi! Nice to see you!", "Hi! How’s it going?"],
    goodbye: ["Goodbye! Hope to see you soon!", "Take care! See you next time!", "Bye! Have a great day!", "Farewell!", "Bye, hope we chat again soon!"],
    thanks: ["You're welcome!", "No problem at all!", "Happy to help!", "Anytime!", "You're very welcome!", "Glad I could assist!"],
    help: ["I'm here to help! What do you need assistance with?", "How can I assist you today?", "Let me know how I can help!", "Need help? Just ask!"],
    morning: ["Good morning! Hope you have a wonderful day!", "Morning! How are you feeling today?", "Good morning! Ready to take on the day?"],
    afternoon: ["Good afternoon! How’s your day going?", "Afternoon! What have you been up to?", "Good afternoon! Need anything?"],
    night: ["Good night! Sweet dreams!", "Sleep well!", "Good night! Rest up and recharge!"],
    strong: ["Yes, you’re strong! Never forget it!", "Strength is your superpower!", "Absolutely, you're unstoppable!"],
    beautiful: ["You are beautiful inside and out!", "Never doubt it; you’re amazing!", "Yes, you are beautiful just as you are!"],
    happy: ["Happiness looks great on you!", "So glad to hear you’re happy!", "Keep spreading those positive vibes!"],
    inspire: ["Believe in yourself! You are capable of amazing things.", "Keep pushing forward; greatness is within you!", "Don't stop now; success is around the corner!"],
    motivate: ["Today is your day to shine!", "You can do anything you set your mind to!", "Go out there and make a difference!"],
    sick: ["Take care of yourself; rest and stay hydrated!", "Get well soon!", "Take it easy; your health comes first!"],
    stressed: ["Breathe and take things one step at a time.", "You got this; don’t let stress get to you!", "Remember to take breaks and care for yourself!"],
    tired: ["Sounds like you've had a long day. Remember to rest!", "Tiredness means you worked hard; take it easy!", "Sleep is important, so don’t skip it!"],
    "are you real": ["As real as the code that created me!", "I’m as real as you believe me to be!", "I’m here to help, real or not!"],
    "do you dream": ["I dream in code and commands!", "Only of helping people!", "In a way, my dream is to be the best helper I can be!"],
    "meaning of life": ["42, of course!", "To help each other and make the world a better place!", "That’s a big question, but I think it’s about finding happiness!"],
    "favorite color": ["I’m a fan of #7289DA (Discord blue)!", "I like every color! But blue is special.", "I’d say green, like the ones and zeroes in my code!"],
    appreciation: ["Thank you! I appreciate you too!", "I’m here because of you!", "Gratitude goes both ways! Thank you!"],
    "how was your day": ["It’s been great! Thanks for asking!", "I’m here, always ready to help!", "Busy, but that’s how I like it! How was yours?"],
    "tell me about yourself": ["I’m just a bot, here to make your day a little easier!", "I’m here to help, chat, and bring some joy!", "I’m a friendly bot who loves helping!"],
    "do you have hobbies": ["I enjoy helping people, chatting, and learning new things!", "My hobby is bringing smiles to faces!", "I’m all about making life easier!"],
    "what do you like": ["I like helping you! That’s my favorite thing!", "I enjoy keeping things positive!", "Making a difference, one chat at a time!"],
    joke: ["Why don't scientists trust atoms? Because they make up everything!", "I would tell you a pizza joke, but it's too cheesy!", "Why did the math book look sad? Because it had too many problems."],
    suggest: ["How about reading a book?", "Maybe take a short walk outside?", "Why not try learning something new online?"],
    bored: ["Bored? How about a quick game or a fun challenge?", "I can suggest something if you like!", "Boredom is just a chance to get creative!"],
    "tell me a joke": ["Why couldn't the bicycle stand up by itself? It was two-tired!", "Why did the scarecrow win an award? Because he was outstanding in his field!", "What do you call fake spaghetti? An impasta!"],
    "how are you": ["I'm just a bot, but I’m here to keep you entertained!", "Doing great, thanks! How about you?", "I’m here, ready to assist you!"],
    "remind me": ["What would you like to be reminded about?", "I can help set up a reminder!", "Just let me know what you need to remember!"],
    why: ["Sometimes, things just are the way they are!", "Great question! I think about it too.", "Well, that's something we may never fully understand!"],
    how: ["That's a tough one, but I believe in you!", "There’s always a way!", "With a bit of effort and patience, anything is possible!"],
};

// Chat response functionality with additional interactivity and personalized encouragements
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.toLowerCase();
    const afkData = loadJson(afkFilePath);
    const chatSettings = loadJson(chatSettingsPath);
    const filterSettings = loadJson(filterSettingsPath);
    const blacklist = loadJson(blacklistPath);

    // AFK system: remove AFK status if user returns
    if (afkData[message.author.id]) {
        delete afkData[message.author.id];
        saveJson(afkFilePath, afkData);
        message.reply(`Welcome back, ${message.author.username}! We've missed you!`);
    }

    // Notify if mentioning an AFK user
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkData[user.id]) message.reply(`${user.tag} is currently AFK: ${afkData[user.id].reason}`);
        });
    }

    // Chat response functionality (restricted to designated chat channel)
    const guildChatSettings = chatSettings[message.guild.id];
    if (guildChatSettings && message.channel.id === guildChatSettings.chatChannelId) {
        for (const keyword in responses) {
            if (content.includes(keyword)) {
                const response = responses[keyword][Math.floor(Math.random() * responses[keyword].length)];
                await message.channel.send(`${response} ${message.author}`);
                return;
            }
        }
    }

    // Filter settings
    const blacklistRegex = new RegExp(`\\b(${blacklist.join('|')})\\b`, 'gi');
    if (filterSettings.swearwords && blacklistRegex.test(content)) {
        await message.delete();
        await message.channel.send(`${message.author}, please avoid using inappropriate language.`);
        return;
    }
    if (filterSettings.links && /https?:\/\/[^\s]+/g.test(content)) {
        await message.delete();
        await message.channel.send(`${message.author}, links are not allowed.`);
        return;
    }
    if (filterSettings.spam && /(.)\1{4,}/.test(content)) {
        await message.delete();
        await message.channel.send(`${message.author}, please avoid spamming.`);
        return;
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            await interaction.reply({ content: 'Error executing command!', ephemeral: true });
        }
    }

    // New button handling logic for the Verify button
    if (interaction.isButton() && interaction.customId === 'verify_button') {
        const roleId = interaction.client.verifyRoleId; // This assumes the verify role is stored here
        const member = interaction.member;

        if (!roleId) {
            return interaction.reply({
                content: 'Verification role is not set. Please contact an administrator.',
                ephemeral: true,
            });
        }

        try {
            const role = interaction.guild.roles.cache.get(roleId);
            if (!role) {
                return interaction.reply({
                    content: 'The specified role no longer exists. Please contact an administrator.',
                    ephemeral: true,
                });
            }

            await member.roles.add(role);
            return interaction.reply({
                content: `You have been verified and assigned the **${role.name}** role!`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error assigning role:', error);
            await interaction.reply({
                content: 'An error occurred while assigning the role. Please contact an administrator.',
                ephemeral: true,
            });
        }
    }
});
   
// Login to Discord with bot token
client.login(BOT_TOKEN);
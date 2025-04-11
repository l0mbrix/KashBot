require('dotenv').config();


// All I need for my Bot to run properly
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db/db.js'); 
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
});
const { sorryWordsList } = require('./enum/matchWordsList.js');
const { randomSorryReply } = require('./enum/randomReply.js');
const { PermissionsBitField } = require('discord.js');


// Builds a regex pattern to match a word with optional non-alphanumeric characters between letters
const regexCache = new Map();

// Function to check for fuzzy matches
function buildFuzzyRegex(word) { 
  if (regexCache.has(word)) {
    return regexCache.get(word);
  }
  const pattern = `\\b`+ word
    .split('')
    .map(letter => `${letter}[\\W_]*`) // Allow non-alphanumeric characters between letters
    .join('') + `\\b`; // Strict word boundares
  const regex = new RegExp(pattern, 'i'); // i = case-insensitive
  regexCache.set(word, regex); // Store the cache
  return regex;
}

// Function to check for l33t
function leetToNormal(text) {
  return text.replace(/\b[\w@\$!\.]+?\b/g, word => {
    return word
      .replace(/4|@/g, 'a')
      .replace(/3|€/g, 'e')
      .replace(/1|!|\|/g, 'i')
      .replace(/0/g, 'o')
      .replace(/5|\$|z|Z/g, 's')
      .replace(/7/g, 't')
      .replace(/8/g, 'b')
      .replace(/2/g, 'z')
      .replace(/9/g, 'g');
  });
}

// Function to only match "mb" when it's a standalone word
function detectMbExcuse(text) { 
  const mbPattern = /\b[mM][bB]\b/;
  return mbPattern.test(text);
}

// Normalisation du texte (insensibilité casse/accents)
function normalizeText(text) {         // Apply leet speak transformation
  return leetToNormal(text)            // Leet speak into words
    .toLowerCase()                     // Lowercase
    .normalize('NFD')                  // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '')   // Remove accents
    .replace(/[^a-z0-9]/g, '');        // Remove non-alphanumeric characters
}

client.once('ready', () => {
  console.log('Tom Nook est prêt !');
});

// Recherche de mots et réponse du bot
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignoring bot
  
  // Fetch or create message history for user
  const userId = message.author.id;
  const userMessage = message.content;
  //if (!messageHistory.has(userId)) {
    //messageHistory.set(userId, []);
  //}

  //messageHistory.get(userId).push(message.content);
  // const history = messageHistory.get(userId);
  // history.push(message.content.trim().toLowerCase());

  //const recentShortMessages = messageHistory.get(userId).filter(msg => msg.length >= 1 && msg.length <= 3); // Only keep messages with 1-3 characters
  //const combined = recentShortMessages.join('');

  //if (history.length > MAX_HISTORY) {
    //history.shift(); // Delete the oldest message if history exceeds max size
  //}

  // Combine the last 10 messages into a single string
  //const combinedHistory = messageHistory.get(userId).join(' ');
  // Use the matchWordsList to check for words in the combined history
  //for (const mot of sorryWordsList) {
    //if (combinedHistory.includes(mot)) {
      //await message.channel.send(`Espèce de filou ! Tu crois que je ne t'ai pas vu à essayer de gruger ? Pour la peine, +5€ de pénalité ! Ça t'apprendra...`); // Send a message if a match is found in the history
      //messageHistory.set(userId, []); // Clear the history for the user
      //break; // Exit the loop after finding a match
    //}
  //}

  try {
    db.createContributionsTable(db.getServerDb(message.guild.id)); // Create table if none
  } catch (error) {
    console.error(`Erreur lors de la création des tables pour le serveur ${message.guild.id}:`, error);
  }

  const messageNormalisé = normalizeText(message.content); // Normaliser le message
  
  try {
    db.createContributionsTable(db.getServerDb(message.guild.id));
  } catch (error) {
    console.error(`Erreur lors de la création des tables pour le serveur ${message.guild.id}:`, error);
  }

  for (const mot of sorryWordsList) { // Vérifier chaque mot cible
    const regex = buildFuzzyRegex(normalizeText(mot)); // Créer une expression régulière pour vérifier si le mot cible est présent (avec des frontières de mots)
    if (regex.test(normalizeText(message.content))) {
      console.log(`Tentative de contournement trouvée : ${mot}`);

      // Saving + answering
      try {
        db.addOrUpdateContribution(db.getServerDb(message.guild.id), message.author.id, 1);
      } catch (error) {
        console.error(`Erreur lors de la MAJ de la table contribution du serveur ${message.guild.id}:`, error);
      }

      const reponseAleatoire = randomSorryReply[Math.floor(Math.random() * randomSorryReply.length)];
      const responseText = typeof reponseAleatoire === 'function' ? reponseAleatoire(message) : reponseAleatoire; // Vérifier si la réponse est une fonction

      const emoji = message.guild.emojis.cache.get('1260632973796053065'); // Réaction par emoji REPORT du serveur
      if (emoji) {
        message.react(emoji).catch(console.error);
      } else {
        console.error('Emoji non trouvé dans le serveur.');
        message.reply(responseText).catch(console.error); // Reply with the random response if emoji is not found
      }
      break; // Sortir de la boucle après avoir trouvé un mot
    }
  }

  // Get the history of contributions to the piggy bank
  if (message.content.toLowerCase() === '!historique') {
    try {
      const contributions = db.getContributions(db.getServerDb(message.guild.id));
      let historique = 'Historique des contributions :\n';

      for (const contribution of contributions) {
        try {
          const user = await client.users.fetch(contribution.user_id); // Fetch the user by ID
          historique += `<@${user.id}> : ${contribution.montant}€\n`; // Mention the user
        } catch (error) {
          console.error(`Impossible de récupérer l'utilisateur avec l'ID ${contribution.user_id}:`, error);
          historique += `Utilisateur inconnu (${contribution.user_id}) : ${contribution.montant}€\n`; // Fallback for unknown users
        }
      }
      message.reply(historique).catch(console.error);
    } catch (error) {
      console.error(`Erreur lors de la récupération des contributions pour le serveur ${message.guild.id}:`, error);
    }
  }

  // Get total of the piggy bank
  if (message.content.toLowerCase() === '!tirelire') {
    const serverDb = db.getServerDb(message.guild.id); // Define serverDb
    try {
      const total = db.getTotalContributions(serverDb); // Call the function with the database connection
      message.reply(`La tirelire est lourde ! Il y a actuellement ${total}€ à l'intérieur ! 💰`).catch(console.error);
    } catch (error) {
      console.error(`Erreur lors de la récupération de la tirelire pour le serveur ${message.guild.id}:`, error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  // Reset the piggy bank
  if (message.content.toLowerCase() === '!boom') {
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 DIS DONC ! Il n\'y a que l\`administrateur qui a le droit de faire ça !');
    }
    const serverDb = db.getServerDb(message.guild.id);

    // Ask for confirmation
    const confirmationMessage = await message.reply({
      content: `🚨 **Êtes-vous sûr de vouloir réinitialiser la tirelire ?** Tapez "oui" pour confirmer, "non" pour annuler.`,
    });

    // Create a filter to check for the response
    const filter = response => {
      return response.author.id === message.author.id && ['oui', 'non'].includes(response.content.toLowerCase());
    };

    // Await for the response
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
    const userResponse = collected.first().content.toLowerCase();

    const total = db.getTotalContributions(serverDb);
    
    // If "oui"
    if (userResponse === 'oui') {
      try {
        if (total <= 0) {
          serverDb.close(); // Toujours penser à fermer la base
          return message.reply('💸 La tirelire est déjà vide... Tu veux la faire exploser pour des miettes ?');
        }
        
        db.resetContributions(serverDb); 
        message.reply('💥 BOOM ! La tirelire a été vidée !').catch(console.error);
    } catch (error) {
        console.error(`❌ Une erreur est survenue lors de la réinitialisation de la tirelire:`, error);
        // message.reply('❌ Impossible de réinitialiser les contributions pour cet utilisateur. Vérifiez l\'ID ou la mention.');
    }
    } else {

    // If "non"
    message.reply('❌ L\'action a été annulée.');
    } 

    serverDb.close(); // Ensure the database connection is closed
  }

    // try {
      // db.resetContributions(serverDb); // Reset contributions
      // message.reply('💥 BOOM ! La tirelire a été vidée !').catch(console.error);
    // } catch (error) {
      // console.error(`❌ Une erreur est survenue lors de la réinitialisation de la tirelire:`, error);
    // } finally {
      // serverDb.close(); // Ensure the database connection is closed
    // }
  // }

  // Reset contributions for a specific user
  if (message.content.toLowerCase().startsWith('!boomuser')) {
    const args = message.content.split(' ').slice(1); // Extract arguments after the command
    if (args.length === 0) {
      return message.reply('❌ Pour réinitialiser quelqu\'un, il faut le mentionner à la suite de cette commande.');
    }

    // Removed unused userId variable

    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      // If the user is not an admin, send a request to admins
      const adminRole = message.guild.roles.cache.find(role => role.permissions.has(PermissionsBitField.Flags.Administrator));
      if (adminRole) {
        return message.channel.send(`🚨 <@&${adminRole.id}>, ${message.author} demande une réinitialisation des contributions pour <@${userId}>.`);
      } else {
        return message.reply('❌ Aucun rôle administrateur trouvé pour notifier.');
      }
    }

    const serverDb = db.getServerDb(message.guild.id);

    try {
      const user = await client.users.fetch(userId); // Verify the user exists
      db.resetUserContribution(serverDb, userId); // Reset contributions for the specific user
      message.reply(`✅ Les contributions de <@${userId}> ont été réinitialisées !`).catch(console.error);
    } catch (error) {
      console.error(`❌ Une erreur est survenue lors de la réinitialisation des contributions pour l'utilisateur ${userId}:`, error);
      message.reply('❌ Impossible de réinitialiser les contributions pour cet utilisateur. Vérifiez l\'ID ou la mention.').catch(console.error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  // Subtract from the piggy bank
  if (message.content.toLowerCase().startsWith('!soustraction')) {
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 DIS DONC ! Il n\'y a que l\`administrateur qui a le droit de faire ça !');
    }
    const args = message.content.split(' ').slice(1); // Extract arguments after the command
    if (args.length < 2 || isNaN(args[1])) {
      return message.reply('❌ Vous devez spécifier un utilisateur et un montant valide à soustraire.');
    }

    const userId = args[0].replace(/[<@!>]/g, ''); // Extract user ID from mention or raw ID
    const amountToSubtract = parseFloat(args[1]);

    if (amountToSubtract <= 0) {
      return message.reply('❌ Le montant à soustraire doit être supérieur à 0.');
    }

    const serverDb = db.getServerDb(message.guild.id);
    try {
      const userContribution = db.getUserContribution(serverDb, userId); // Get the user's current contribution
      if (!userContribution || userContribution.montant < amountToSubtract) {
        return message.reply('❌ Impossible de soustraire ce montant, l\'utilisateur n\'a pas assez de contributions.');
      }

      db.subtractUserContribution(serverDb, userId, amountToSubtract); // Subtract the specified amount
      message.reply(`✅ ${amountToSubtract}€ ont été soustraits des contributions de <@${userId}> !`).catch(console.error);
    } catch (error) {
      console.error(`❌ Une erreur est survenue lors de la soustraction des contributions pour l'utilisateur ${userId}:`, error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  (db.getServerDb(message.guild.id)).close(); // Close connection
}); // Close the messageCreate event listener

client.login(process.env.DISCORD_TOKEN);
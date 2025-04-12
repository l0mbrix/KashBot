require('dotenv').config();

// All you need for the Bot to run properly
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
const MAX_CACHE_SIZE = 100; // Set a maximum size for the cache

// Function to check for fuzzy matches
function buildFuzzyRegex(word) { 
  if (regexCache.has(word)) {
    return regexCache.get(word);
  }

  // Construct a regex pattern:
  // - `\\b` ensures the match starts and ends at a word boundary.
  const pattern = `\\b` + word
    .split('') // Split the word into letters
    // .map(letter => `${letter}[\\s-]*`) // Allow spaces and hyphens between letters
    // .map(letter => `${letter}[\\W_]*`) // Allow non-alphanumeric characters between letters
    .join('[\\s.,!?-]*') + `\\b`; // Match until a word boundary or whitespace
    const regex = new RegExp(pattern, 'i'); // i = case-insensitive
  
  // if (regexCache.size >= MAX_CACHE_SIZE) {
    // const oldestKey = regexCache.keys().next().value; // Get the oldest key
    // regexCache.delete(oldestKey); // Remove the oldest entry
  // }
  regexCache.set(word, regex); // Store the cache
  return regex;
}

// Function to check for l33t speak
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

// Function to normalize text
function normalizeText(text) {         // Apply l33t speak transformation
  return leetToNormal(text)            // L33t speak into words
    .toLowerCase()                     // Lowercase
    .normalize('NFD')                  // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '')   // Remove accents
    .replace(/[^a-z0-9\s.,!?]/g, '');  // Keep spaces and common punctuation
}

// Console log
client.once('ready', () => {
  console.log('Tom Nook est prêt !');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignoring Bot's messages
  
  // Fetch or create message history for user
  const userId = message.author.id;
  const userMessage = message.content;

  try {
    db.createContributionsTable(db.getServerDb(message.guild.id)); // Create table if none
  } catch (error) {
    console.error(`Erreur lors de la création des tables pour le serveur ${message.guild.id}:`, error);
  }
  const messageNormalisé = normalizeText(message.content);
  try {
    db.createContributionsTable(db.getServerDb(message.guild.id));
  } catch (error) {
    console.error(`Erreur lors de la création des tables pour le serveur ${message.guild.id}:`, error);
  }

  for (const mot of sorryWordsList) { // Check each word in the list
    const regex = buildFuzzyRegex(normalizeText(mot));
    if (regex.test(message.content)) {
      console.log(`Tentative de contournement trouvée : ${mot}`);
      break;
      

      // Saving + answering
      try {
        db.addOrUpdateContribution(db.getServerDb(message.guild.id), message.author.id, 1);
      } catch (error) {
        console.error(`Erreur lors de la MAJ de la table contribution du serveur ${message.guild.id}:`, error);
      }
      const reponseAleatoire = randomSorryReply[Math.floor(Math.random() * randomSorryReply.length)];
      const responseText = typeof reponseAleatoire === 'function' ? reponseAleatoire(message) : reponseAleatoire;
      const emoji = message.guild.emojis.cache.get('1260632973796053065');
      if (emoji) {
        message.react(emoji).catch(console.error);
      } else {
        console.error('Emoji non trouvé dans le serveur.');
      } 
      message.reply(responseText).catch(console.error);
      break; // Break the loop if a match is found
    }
  }

  // Get the history of contributions to the piggy bank
  if (message.content.toLowerCase() === '!historique') {
    try {
      const contributions = db.getContributions(db.getServerDb(message.guild.id));
      let historique = 'Voici l\'historique des contributions :\n';
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
      message.reply(`Il y a actuellement ${total}€ à l'intérieur de la tirelire ! 💰`).catch(console.error);
    } catch (error) {
      console.error(`Erreur lors de la récupération de la tirelire pour le serveur ${message.guild.id}:`, error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  // Reset the piggy bank
  if (message.content.toLowerCase() === '!boom') {
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('Bien essayé mais seules les administratrices ont le droit de faire ça ! 😘');
    }
    const serverDb = db.getServerDb(message.guild.id);

    // Ask for confirmation
    const confirmationMessage = await message.reply({
      content: `**Es-tu certaine de vouloir réinitialiser la tirelire ?** Tape "oui" pour confirmer, "non" pour annuler.`,
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
          serverDb.close();
          return message.reply('La tirelire est déjà vide... Tu veux la faire exploser pour des miettes ? 💸');
        }
        
        db.resetContributions(serverDb); 
        message.reply('💥 BOOM ! La tirelire a été vidée ! 💥').catch(console.error);
    } catch (error) {
        console.error(`Une erreur est survenue lors de la réinitialisation de la tirelire:`, error);
    }
    } else {

    // If "non"
    message.reply('L\'action a été annulée. ');
    } 

    serverDb.close(); // Ensure the database connection is closed
  }

  // Reset contributions for a specific user
  if (message.content.toLowerCase().startsWith('!boomuser')) {
    const args = message.content.split(' ').slice(1); // Extract arguments after the command
    if (args.length === 0) {
      return message.reply('Pour réinitialiser quelqu\'un, il faut le mentionner à la suite de cette commande. ⚠️');
    }

    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      // If the user is not an admin, send a request to admins
      return message.reply('Dis donc ! Tu n\'as pas les permissions d\'utiliser cette commande. 👀');
   }

    const serverDb = db.getServerDb(message.guild.id);

    try {
      const user = await client.users.fetch(userId); // Verify the user exists
      db.resetUserContribution(serverDb, userId); // Reset contributions for the specific user
      message.reply(`Les contributions de <@${userId}> ont été réinitialisées ! 💸`).catch(console.error);
    } catch (error) {
      console.error(`Une erreur est survenue lors de la réinitialisation des contributions pour l'utilisateur ${userId}:`, error);
      message.reply('Impossible de réinitialiser les contributions pour cet utilisateur. Vérifiez l\'ID ou la mention. ⚠️').catch(console.error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  // Subtract from the piggy bank
  if (message.content.toLowerCase().startsWith('!soustraction')) {
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('Je crois que tu t\'es perdu... Cette commande n\'est accessible qu\'aux administratrices. 📯');
    }
    const args = message.content.split(' ').slice(1); // Extract arguments after the command
    if (args.length < 2 || isNaN(args[1])) {
      return message.reply('Vous devez spécifier un utilisateur et un montant valide à soustraire. ⚠️');
    }

    const userId = args[0].replace(/[<@!>]/g, ''); // Extract user ID from mention or raw ID
    const amountToSubtract = parseFloat(args[1]);

    if (amountToSubtract <= 0) {
      return message.reply('Le montant à soustraire doit être supérieur à 0. ⚠️');
    }

    const serverDb = db.getServerDb(message.guild.id);
    try {
      const userContribution = db.getUserContribution(serverDb, userId); // Get the user's current contribution
      if (!userContribution || userContribution.montant < amountToSubtract) {
        return message.reply('Impossible de soustraire ce montant, l\'utilisateur n\'a pas assez de contributions. ⚠️');
      }

      db.subtractUserContribution(serverDb, userId, amountToSubtract); // Subtract the specified amount
      message.reply(`${amountToSubtract}€ ont été soustraits des contributions de <@${userId}> ! 💸`).catch(console.error);
    } catch (error) {
      console.error(`Une erreur est survenue lors de la soustraction des contributions pour l'utilisateur ${userId}:`, error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  if (message.content.toLowerCase() === '!help') {
    const helpMessage = `
    🚀 **Voici la liste des commandes disponibles :**
  
    **!tirelire** - Affiche le montant total dans la tirelire.
    **!historique** - Affiche le total des contributions des membres à la tirelire.

    **___Admin Only___**
    **!boom** - Réinitialise la tirelire.
    **!boomuser <mention_utilisateur>** - Réinitialise les contributions d'un utilisateur spécifique.
    **!soustraction <montant>** - Retire un montant du solde d'un utilisateur.
    **!reset** - Réinitialise toutes les contributions.
    **!baffe <mention_utilisateur>** - Ajoute 1 € au solde de l'utilisateur mentionné.
    `;
  
    // Send the help message
    message.reply(helpMessage);
  }

  // Slap a user
  if (message.content.toLowerCase().startsWith('!baffe')) {
    // Check if the user has permission to slap
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('Seules les administratrices peuvent distribuer des baffes ! 😏');
    }
  
    // Extract the user mention from the message
    const args = message.content.split(' ').slice(1); // Extrait les arguments
    if (args.length === 0) {
      return message.reply('Mentionne l\'utilisateur à qui tu veux donner une baffe ! ⚠️');
    }
  
    const userId = args[0].replace(/[<@!>]/g, ''); // Get the user ID from the mention
    const serverDb = db.getServerDb(message.guild.id);
  
    // Add 1 € to the user's balance
    try {
      const user = serverDb.prepare('SELECT * FROM contributions WHERE user_id = ?').get(userId);
      if (user) {
        // If the user exists, update their balance
        serverDb.prepare('UPDATE contributions SET montant = montant + 1 WHERE user_id = ?').run(userId);
      } else {
        // If the user doesn't exist, insert them with a balance of 1 €
        serverDb.prepare('INSERT INTO contributions (user_id, montant) VALUES (?, 1)').run(userId);
      }
      message.reply(`1 € a été ajouté au solde de <@${userId}>. Ça lui apprendra ! 🕊`);
    } catch (error) {
      console.error(`Une erreur est survenue lors de l'ajout de 1 € pour <@${userId}>:`, error);
      message.reply('Impossible d\'ajouter 1 € à ce utilisateur. Vérifie la mention. ⚠️');
    } finally {
      serverDb.close();
    }
  }

  (db.getServerDb(message.guild.id)).close(); // Close connection
}); // Close the messageCreate event listener

client.login(process.env.DISCORD_TOKEN);
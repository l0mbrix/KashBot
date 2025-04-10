require('dotenv').config();


// All I need for my Bot to run properly
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db/db.js'); 
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,],
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
  if (message.author.bot) return; // Ne pas répondre aux messages du bot lui-même
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

  // Commande pour consulter les contributions individuelles
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

  if (message.content.toLowerCase() === '!boom') {
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 DIS DONC ! Il n\'y a que l\`administrateur qui a le droit de faire ça !');
    }
    const serverDb = db.getServerDb(message.guild.id);
    try {
      db.resetContributions(serverDb); // Reset contributions
      message.reply('💥 BOOM ! La tirelire a été vidée !').catch(console.error);
    } catch (error) {
      console.error(`❌ Une erreur est survenue lors de la réinitialisation de la tirelire:`, error);
    } finally {
      serverDb.close(); // Ensure the database connection is closed
    }
  }

  (db.getServerDb(message.guild.id)).close(); // Close connection
}); // Close the messageCreate event listener

client.login(process.env.DISCORD_TOKEN);
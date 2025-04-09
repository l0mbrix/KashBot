require('dotenv').config();

// All I need for my Bot to run properly
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db/db.js'); 
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers,],
});
const { sorryWordsList } = require('./enum/matchWordsList.js');
const { randomSorryReply } = require('./enum/randomReply.js');

// Normalisation du texte (insensibilité casse/accents)
function normalizeText(text) {
  return text
    .toLowerCase()                          // Convertir en minuscules
    .normalize('NFD')                       // Normalisation Unicode
    .replace(/[\u0300-\u036f]/g, '');       // Retirer les accents
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

  sorryWordsList.forEach((mot) => { // Vérifier chaque mot cible
    const regex = new RegExp(`\\b${normalizeText(mot)}\\b`, 'i'); // Créer une expression régulière pour vérifier si le mot cible est présent (avec des frontières de mots)

    if (regex.test(messageNormalisé)) {
      console.log(`ALERTE ! Le mot "${mot}" a été employé !`);
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
    }
  });

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
  (db.getServerDb(message.guild.id)).close(); // Close connection
});

client.login(process.env.DISCORD_TOKEN);
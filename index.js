require('dotenv').config();

// All I need for my Bot to run properly
const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db/db.js'); 
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
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
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // Ne pas répondre aux messages du bot lui-même
  const messageNormalisé = normalizeText(message.content); // Normaliser le message
  const serverDb = db.getServerDb(message.guild.id); // Fetch guild's db
  
  try {
    db.createCagnotteTable(serverDb);
    db.createContributionsTable(serverDb);
  } catch (error) {
    console.error(`Erreur lors de la création des tables pour le serveur ${message.guild.id}:`, error);
  }

  sorryWordsList.forEach((mot) => { // Vérifier chaque mot cible
    const regex = new RegExp(`\\b${normalizeText(mot)}\\b`, 'i'); // Créer une expression régulière pour vérifier si le mot cible est présent (avec des frontières de mots)

    if (regex.test(messageNormalisé)) {
      try {
        db.addMontantToCagnotte(serverDb, 1);
        db.addOrUpdateContribution(serverDb, message.author.id, 1);
        console.log(`ALERTE ! Le mot "${mot}" a été employé !`);
      } catch (error) {
        console.error(`Erreur lors de l'ajout de contributions pour le serveur ${message.guild.id}:`, error);
      }

      const reponseAleatoire = randomSorryReply[Math.floor(Math.random() * randomSorryReply.length)];
      message.reply(`${reponseAleatoire(message)} La cagnotte est maintenant de ${db.getCagnotteTotal(serverDb)}€.`);
      const emoji = message.guild.emojis.cache.get('1260632973796053065'); // Réaction par emoji REPORT du serveur
      if (emoji) {
        message.react(emoji).catch(console.error);
      }
    }
  });

  // Commande de consultation de la cagnotte générale
  if (message.content.toLowerCase() === '!cagnotte') {
    try {
      message.reply(`La cagnotte actuelle est de ${db.getCagnotteTotal(serverDb)}€. 💼`);
    } catch (error) {
      console.error(`Erreur lors de la récupération de la cagnotte pour le serveur ${message.guild.id}:`, error);
    }
  }

  // Commande pour consulter les contributions individuelles
  if (message.content.toLowerCase() === '!historique') {
    try {
      const contributions = db.getContributions(serverDb);
      let historique = 'Historique des contributions :\n';
      contributions.forEach((contribution) => {
        historique += `<@${contribution.user_id}> : ${contribution.montant}€\n`;
      });
      message.reply(historique);
    } catch (error) {
      console.error(`Erreur lors de la récupération des contributions pour le serveur ${message.guild.id}:`, error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN); 
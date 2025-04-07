require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Test d'importation sorryWordsList et randomSorryReply
const { sorryWordsList } = require('./enum/matchWordsList.js');
const { randomSorryReply } = require('./enum/randomReply.js');

// Stockage des contributions
let cagnotte = 0; // Cagnotte globale
let contributions = {}; // Contributions par utilisateur
// const motsCibles = ['désolé', 'désolée', 'déso', 'dsl', 'sorry', 'sry', 'mea culpa', 'mea maxima culpa', 'm\'excuse', 'm\'excuser', 'excuse', 'pardon', 'pardonnez', 'mb', 'my bad']; // Liste des mots cibles

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

  sorryWordsList.forEach((mot) => { // Vérifier chaque mot cible
    const regex = new RegExp(`\\b${normalizeText(mot)}\\b`, 'i'); // Créer une expression régulière pour vérifier si le mot cible est présent (avec des frontières de mots)

    if (regex.test(messageNormalisé)) {
      cagnotte += 1; // Mettre à jour la cagnotte

      if (!contributions[message.author.id]) {
        contributions[message.author.id] = 0;
      }
      contributions[message.author.id] += 1; // Mettre à jour la contribution de l'utilisateur

      console.log(`ALERTE ! Le mot "${mot}" a été employé !`);

      const reponseAleatoire = randomSorryReply[Math.floor(Math.random() * randomSorryReply.length)];
      const messageFinal = reponseAleatoire(message); // Exécution de la fonction avec "message"

      //const reponseAleatoire = reponses[Math.floor(Math.random() * reponses.length)]; // Choix d'une réponse aléatoire dans le tableau
      // message.channel.send(`Bouuuh **${message.author.username}**. La cagnotte est maintenant de ${cagnotte}€.`);
      
      message.reply(`${reponseAleatoire(message)} La cagnotte est maintenant de ${cagnotte}€.`);
      const emoji = message.guild.emojis.cache.get('1260632973796053065'); // Réaction par emoji REPORT du serveur
      if (emoji) {
        message.react(emoji).catch(console.error);
      }
    }
  });

  // Commande de consultation de la cagnotte générale
  if (message.content.toLowerCase() === '!cagnotte') {
    message.reply(`La cagnotte actuelle est de ${cagnotte}€. 💼`);
  }

  // Commande pour consulter les contributions individuelles
  if (message.content.toLowerCase() === '!historique') {
    let historique = 'Historique des contributions :\n';
    for (let userId in contributions) {
      historique += `<@${userId}> : ${contributions[userId]}€\n`;
    }
    message.reply(historique);
  }
});

client.login(process.env.DISCORD_TOKEN); 
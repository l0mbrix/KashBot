// Here you can set up the random sentences your bot will reply to users infringing your rules (matchWordsList).
const randomSorryReply = [
    (message) => `💸 Et hop ! 1€ de plus dans la cagnotte`, 
    (message) => `😏 Ben alors **${message.author.username}**, on s\'excuse encore ?`,
    (message) => `💰 Dis-donc ! On n\'avait pas dit qu\'on ne s\'excusait plus ici ?`,
    (message) => `🪙 ALERTE CONTRIBUTION ! **${message.author.username}** vient d\'ajouter 1 nouvel € dans la boite !`
];

module.exports = { randomSorryReply };
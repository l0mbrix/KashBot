// Here you can set up the random sentences your bot will reply to users infringing your rules (matchWordsList).

module.exports.randomSorryReply = [
    // Fonction qui acceptent message et retourne une réponse
    (message) => `💸 Et hop ! 1€ de plus dans la cagnotte`, 
    (message) => `😏 Ben alors **${message.member.displayName}**, on s\'excuse encore ?`,
    (message) => `💰 Dis-donc ! On n\'avait pas dit qu\'on ne s\'excusait plus ici ?`,
    (message) => `🪙 ALERTE CONTRIBUTION ! **${message.member.displayName}** vient d\'ajouter 1 nouvel € dans la boite !`
];
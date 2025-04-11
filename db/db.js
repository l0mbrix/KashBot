const betterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB directory
const databaseDirectory = path.join(__dirname, 'database');

// Checking if DB directory already exists
if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory);
}

// Function to obtain a specific db for a guild
function getServerDb(guildId) {
    const dbPath = path.join(databaseDirectory, `serveur_${guildId}.db`);
    // Creating-opening a guild db
    return betterSqlite3(dbPath);
}

// Funct to create a table for users
function createContributionsTable(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS contributions (
        user_id TEXT PRIMARY KEY,
        montant INTEGER
        )
    `);
}

// Funct to add-update contributions by user
function addOrUpdateContribution(db, userId, montant) {
    const existingUser = db.prepare('SELECT * FROM contributions WHERE user_id = ?').get(userId);
    if (existingUser) {
        db.prepare('UPDATE contributions SET montant = montant + ? WHERE user_id = ?').run(montant, userId);
    } else {
        db.prepare('INSERT INTO contributions (user_id, montant) VALUES (?, ?)').run(userId, montant);
    }
    // Check if the user already exists in the table
    return existingUser ? 'updated' : 'added'; // Return the action performed
}

// Function to SUM all the contributions
function getTotalContributions(db) {
    const row = db.prepare('SELECT SUM(montant) AS total FROM contributions').get();
    return row.total || 0; // Return the total or 0 if no contributions
}

// Funct to get gild's contribution
function getContributions(db) {
    return db.prepare('SELECT user_id, montant FROM contributions').all();
}

// Funct to reset the piggy bank
function resetContributions(db){
    db.prepare('DELETE FROM contributions').run();
}

// Funct to reset a specific user's contributions
function resetUserContribution(db, userId) {
    db.prepare('DELETE FROM contributions WHERE user_id = ?').run(userId);
}

// Funct to get a specific user's contribution
function getUserContribution(db, userId) {
    return db.prepare('SELECT * FROM contributions WHERE user_id = ?').get(userId);
}

// Funct to substract a specific user's contribution
function subtractUserContribution(db, userId, amount) {
    const current = getUserContribution(db, userId);
    if (!current) throw new Error("Utilisateur introuvable.");
    if (current.montant < amount) throw new Error("Fonds insuffisants.");

    db.prepare('UPDATE contributions SET montant = montant - ? WHERE user_id = ?').run(amount, userId);
}

module.exports = {
    getServerDb,
    createContributionsTable,
    addOrUpdateContribution,
    getContributions,
    getTotalContributions,
    resetContributions,
    resetUserContribution,
    getUserContribution,
    subtractUserContribution,
};
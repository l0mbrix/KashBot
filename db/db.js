const betterSqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB directory
const databaseDirectory = path.join(__dirname, 'database');

// Checking if DB directory already exists
if (!fs.existsSync(databaseDirectory)) {
    fs.mkdirSync(databaseDirectory);
}

// Funct to obtain a specific db for a guild
function getServerDb(guildId) {
    const dbPath = path.join(databaseDirectory, `serveur_${guildId}.db`);

    // Creating-opening a guild db
    return betterSqlite3(dbPath);
}

// Funct to create a table in guild db if none
function createCagnotteTable(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS cagnotte (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        montant INTEGER
        )
    `).run();
}

// Funct to add numbers
function addMontantToCagnotte(db, montant) {
    const insert = db.prepare('INSERT INTO cagnotte (montant) VALUES (?)');
    insert.run(montant);
}

// Funct to get total numbers
function getCagnotteTotal(db) {
    const row = db.prepare('SELECT SUM(montant) AS total FROM cagnotte').get();
    return row.total || 0;
}

// Funct to create a table for users
function createContributionsTable(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS contributions (
        user_id TEST PRIMARY KEY,
        montant INTEGER
        )
    `).run();
}

// Funct to add-update contributions by user
function addOrUpdateContribution(db, userId, montant) {
    const existingUser = db.prepare('SELECT * FROM contributions WHERE user_id = ?').get(userId);
    if (existingUser) {
        db.prepare('UPDATE contributions SET montant = montant + ? WHERE user_id = ?').run(montant, userId);
    } else {
        db.prepare('INSERT INTO contributions (user_id, montant) VALUES (?, ?').run(userId, montant);
    }
}

// Funct to get gild's contribution
function getContributions(db) {
    return db.prepare('SELECT user_id, montant FROM contributions').all();
}

module.exports = {
    getServerDb,
    createCagnotteTable,
    addMontantToCagnotte,
    getCagnotteTotal,
    createContributionsTable,
    addOrUpdateContribution,
    getContributions,
};
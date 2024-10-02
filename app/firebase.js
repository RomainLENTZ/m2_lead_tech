const admin = require('firebase-admin');
const path = require ('path');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://dmii-2024-default-rtdb.europe-west1.firebasedatabase.app'
})

const dataBase = admin.database()

module.exports = dataBase
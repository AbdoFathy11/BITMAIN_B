const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
    name: { type: String, required: true },
    number: { type: String, required: true },
    active: { type: Boolean, default: false }
});

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports =  Wallet;

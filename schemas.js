const mongoose = require('mongoose');
const { Schema } = mongoose;

// User schema
const userSchema = new Schema({
  admin: {type: Boolean, default: false },
  name: {type: String },
  from: { type: Schema.Types.ObjectId, ref: 'User' },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  daily_profit: { type: Number, default: 20 },
  products: {
    default: {
      start: new Date(Date.now()),
      price: 100,
      percentage: 0.10,
      name: "فائدة التسجيل",
      total_profit: 3600,
      total_percentage: 36.0,
      got_profit: 0,
      got_percentage: 0,
      spent_days: 0,
      period: 360,
    },
    type: [{
    start: { type: Date, default: Date.now },
    price: { type: Number, required: true },
    percentage: { type: Number, required: true },
    name: { type: String, required: true },
    total_profit: { type: Number, required: true },
    total_percentage: { type: Number, required: true },
    got_profit: { type: Number, required: true },
    got_percentage: { type: Number, required: true },
    spent_days: { type: Number, required: true },
    period: { type: Number, required: true },
  }]},
  joined: { type: Date, default: Date.now},
  last_balance_update: { type: Date, default: Date.now},
  wallet_number: { type: String },
  wallet_name: { type: String },
  wallet_company: { type: String },
  invites_q: { type: Number, default: 0 },
  invites_p: { type: Number, default: 0 },
  widrawal_request: [
    {
        amount: { type: Number, required: true },
        status: { type: Number, default: 0 },
        start: { type: Date, default: Date.now },
        success_date: { type: Date },
      }
  ],
  deposits: [{
    from: {type: String, required: true},
    amount: {type: Number, required: true},
    to: {type: String, required: true},
    date: {type: Date, default: Date.now },
    status: {type: Number, default: 0} // 0: Pending, 1: success, 2: faild
    }
  ]
});

// Create models
const User = mongoose.model('User', userSchema);

module.exports =  User;
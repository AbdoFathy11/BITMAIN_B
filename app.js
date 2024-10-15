const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const router = require('./router');
const { dashboardData, setActiveWallet } = require('./handler');
const Wallet = require('./walletSchema');
const { HTTPS } = require('express-sslify');

// Initialize Express app and configure environment variables
const app = express();
// app.use(HTTPS({ trustProtoHeader: true }));
dotenv.config();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());


app.use(bodyParser.json());

// Function to initialize wallets in the database if not already present
async function initializeWallets() {
  try {
    const existingWallets = await Wallet.find();

    if (existingWallets.length === 0) {
      const wallets = [
        { name: 'Amer', number: '01060990626', active: true },
        { name: 'Fathy', number: '01090471679', active: false }
      ];
      await Wallet.insertMany(wallets);
      console.log('Wallets initialized successfully');
    } else {
      console.log('Wallets already initialized');
    }
  } catch (error) {
    console.error('Error initializing wallets:', error.message);
  }
}

// Routes
app.get('/getWallets', async (req, res) => {
  try {
    const wallets = await Wallet.find();
    res.json(wallets);
  } catch (error) {
    console.error('Error retrieving wallets:', error.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve wallets' });
  }
});

app.post('/api/wallet/activate', async (req, res) => {
  try {
    await initializeWallets(); // Ensure wallets are initialized
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({ success: false, message: 'Wallet name is required' });
    }

    const updatedWallet = await setActiveWallet(wallet);
    res.json({ success: true, data: updatedWallet });
  } catch (error) {
    console.error('Error activating wallet:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/wallet', async (req, res) => {
  try {
    await initializeWallets(); // Ensure wallets are initialized
    const activeWallet = await Wallet.findOne({ active: true });

    if (!activeWallet) {
      return res.status(404).json({ success: false, message: 'No active wallet found' });
    }

    res.json({ success: true, data: activeWallet });
  } catch (error) {
    console.error('Error retrieving active wallet:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const users = await dashboardData();
    res.json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data: users
    });
  } catch (error) {
    console.error('Error retrieving dashboard data:', error.message);
    res.status(500).json({
      success: false,
      message: `Error finding users: ${error.message}`
    });
  }
});

app.get('/', async (req, res) => {
  try {
    res.json('Hello World!');
  } catch (error) {
    console.error('Error on root route:', error.message);
    res.status(500).json({ success: false, message: 'Error initializing wallets' });
  }
});

// Use the user router for user-related routes
app.use('/api/user', router);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.DATABASE);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    app.listen(port, '0.0.0.0', () => {
      console.log('Server running on port 3000')
    });
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1); // Exit process with failure
  }
};

connectDB();

module.exports = app;

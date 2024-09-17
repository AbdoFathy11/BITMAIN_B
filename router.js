const express = require('express');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { UserClass } = require('./handler'); // Adjust path as necessary
const User = require('./schemas'); // Adjust path as necessary
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
dotenv.config();

const router = express.Router();
const userClass = new UserClass();

// Middleware to check if the user is an admin
async function adminOnly(req, res, next) {
  try {
    const token = req.cookies.authToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);
    if (!decoded || !decoded.admin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: `Error verifying token: ${error.message}` });
  }
}

// Middleware to verify the token and attach user to the request
function verifyToken(req, res, next) {
  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);
    if (decoded.exp * 1000 < Date.now()) {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: `Invalid token: ${error.message}` });
  }
}

// Route: Create a new user
router.post('/', async (req, res) => {
  try {
    const newUser = await userClass.create(req.body);
    res.json({ success: true, message: 'User created successfully', data: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error creating user: ${error.message}` });
  }
});

// Route: Sign in a user
router.post('/signin', async (req, res) => {
  try {
    const userSign = await userClass.signIn(req.body);
    res.json(userSign);
  } catch (error) {
    res.status(500).json({ success: false, message: `Error signing in: ${error.message}` });
  }
});

router.get('/export', async (req, res) => {
  try {
    const users = await userClass.findAll(); // Fetch users from the database

    // Define file paths
    const usersFilePath = path.join(__dirname, 'users.csv');
    const withdrawFilePath = path.join(__dirname, 'withdraw.csv');
    const depositFilePath = path.join(__dirname, 'depo.csv');

    // Define CSV writer for users
    const userCsvWriter = createCsvWriter({
      path: usersFilePath,
      header: [
        { id: 'admin', title: 'Admin' },
        { id: 'name', title: 'Name' },
        { id: 'phone', title: 'Phone' },
        { id: 'balance', title: 'Balance' },
        { id: 'joined', title: 'Joined Date' },
        { id: 'wallet_number', title: 'Wallet Number' },
        { id: 'wallet_name', title: 'Wallet Name' },
        { id: 'wallet_company', title: 'Wallet Company' },
        { id: 'invites_q', title: 'Invites Quantity' },
        { id: 'invites_p', title: 'Got from Invites' },
        { id: 'last_balance_update', title: 'Last Balance Update' }
      ]
    });

    // Define CSV writer for withdrawals
    const withdrawCsvWriter = createCsvWriter({
      path: withdrawFilePath,
      header: [
        { id: 'name', title: 'User Name' },
        { id: 'phone', title: 'User Phone' },
        { id: 'amount', title: 'Withdrawal Amount' },
        { id: 'status', title: 'Withdrawal Status' },
        { id: 'start', title: 'Request Date' },
        { id: 'success_date', title: 'Success Date' }
      ]
    });

    // Define CSV writer for deposits
    const depositCsvWriter = createCsvWriter({
      path: depositFilePath,
      header: [
        { id: 'name', title: 'User Name' },
        { id: 'phone', title: 'User Phone' },
        { id: 'from', title: 'Deposit From' },
        { id: 'to', title: 'Deposit To' },
        { id: 'amount', title: 'Deposit Amount' },
        { id: 'status', title: 'Deposit Status' },
        { id: 'date', title: 'Deposit Date' }
      ]
    });

    // Prepare data for users.csv (excluding array fields)
    const userRecords = users.map(user => ({
      id: user._id,
      admin: user.admin,
      name: user.name,
      from: user.from ? user.from._id : '',
      phone: user.phone,
      balance: user.balance,
      daily_profit: user.daily_profit,
      joined: user.joined,
      wallet_number: user.wallet_number,
      wallet_name: user.wallet_name,
      wallet_company: user.wallet_company,
      invites_q: user.invites_q,
      invites_p: user.invites_p,
      last_balance_update: user.last_balance_update
    }));

    // Prepare data for withdraw.csv
    const withdrawRecords = users.reduce((acc, user) => {
      const withdrawals = user.widrawal_request.map(withdrawal => ({
        name: user.name,
        phone: user.phone,
        amount: withdrawal.amount,
        status: withdrawal.status,
        start: withdrawal.start,
        success_date: withdrawal.success_date
      }));
      return acc.concat(withdrawals);
    }, []);

    // Prepare data for depo.csv
    const depositRecords = users.reduce((acc, user) => {
      const deposits = user.deposits.map(deposit => ({
        name: user.name,
        phone: user.phone,
        from: deposit.from,
        to: deposit.to,
        amount: deposit.amount,
        status: deposit.status,
        date: deposit.date
      }));
      return acc.concat(deposits);
    }, []);

    // Write data to CSVs
    await userCsvWriter.writeRecords(userRecords);
    await withdrawCsvWriter.writeRecords(withdrawRecords);
    await depositCsvWriter.writeRecords(depositRecords);

    // Respond with success
    res.status(200).json({ success: true, message: 'CSV files created successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error exporting data: ${error.message}` });
  }
});

// Route: Find a user by ID
router.get('/:id', async (req, res) => {
  try {
    const user = await userClass.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User found', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error finding user: ${error.message}` });
  }
});

// Route: Find all users (consider pagination for large datasets)
router.get('/', async (req, res) => {
  try {
    const users = await userClass.findAll();
    res.json({ success: true, message: 'Users retrieved successfully', data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error retrieving users: ${error.message}` });
  }
});



// Route: Update a user by ID
router.put('/update/:id', async (req, res) => {
  try {
    const updatedUser = await userClass.updateById(req.params.id, req.body);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User updated successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error updating user: ${error.message}` });
  }
});

// Route: Update a specific field in a user by ID
router.patch('/:id/:item', async (req, res) => {
  try {
    const updatedUser = await userClass.updateItemById(req.params.id, req.params.item, req.body.value);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User item updated successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error updating user item: ${error.message}` });
  }
});

// Route: Delete a user by ID (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const result = await userClass.deleteById(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error deleting user: ${error.message}` });
  }
});

// Route: Add a product to a user
router.put('/:id/products', async (req, res) => {
  try {
    const updatedUser = await userClass.addProduct(req.params.id, req.body);
    res.json({ success: true, message: 'Product added successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error adding product: ${error.message}` });
  }
});

// Route: Increase user invites quantities
router.put('/:id/invq/increase', async (req, res) => {
  try {
    const updatedUser = await userClass.increaseInvitesQ(req.params.id, req.body.amount);
    res.json({ success: true, message: 'Invites quantity increased successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error increasing invites: ${error.message}` });
  }
});

// Route: Decrease user invites quantities
router.put('/:id/invq/decrease', async (req, res) => {
  try {
    const updatedUser = await userClass.decreaseInvitesQ(req.params.id, req.body.amount);
    res.json({ success: true, message: 'Invites quantity decreased successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error decreasing invites: ${error.message}` });
  }
});

// Route: Increase user invites profit
router.put('/:id/invp/increase', async (req, res) => {
  try {
    const updatedUser = await userClass.increaseInvitesP(req.params.id, req.body.amount);
    res.json({ success: true, message: 'Invites profit increased successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error increasing invites profit: ${error.message}` });
  }
});

// Route: Add a deposit to a user
router.post('/:id/deposits', async (req, res) => {
  try {
    const updatedUser = await userClass.addDeposit(req.params.id, req.body);
    res.json({ success: true, message: 'Deposit added successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error adding deposit: ${error.message}` });
  }
});

// Route: Change withdrawal status
router.put('/:id/withdrawals/:withdrawId/status', async (req, res) => {
  try {
    const updatedUser = await userClass.changeWithdrawStatus(req.params.id, req.params.withdrawId, req.body.status);
    res.json({ success: true, message: 'Withdrawal status updated successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error changing withdrawal status: ${error.message}` });
  }
});

// Route: Change deposit status
router.put('/:id/deposits/:depositId/status', async (req, res) => {
  try {
    const updatedUser = await userClass.changeDepositStatus(req.params.id, req.params.depositId, req.body.status);
    res.json({ success: true, message: 'Deposit status updated successfully', data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error changing deposit status: ${error.message}` });
  }
});

// Route: Verify if the user is still logged in (Token check)
router.get('/showmeifyourstillin', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Token is valid' });
});

// Route: Update status based on property type (Withdrawal or Deposit)
router.put('/updateStatus', async (req, res) => {
  const { status, userId, requestId, prop } = req.body;
  if (![0, 1, 2].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(userObjectId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (prop === 'w') {
      const withdrawal = user.widrawal_request.id(requestId);
      if (!withdrawal) {
        return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
      }
      withdrawal.status = status;
    } else if (prop === 'd') {
      const deposit = user.deposits.id(requestId);
      if (!deposit) {
        return res.status(404).json({ success: false, message: 'Deposit request not found' });
      }
      deposit.status = status;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid property type' });
    }

    await user.save();
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Error updating status: ${error.message}` });
  }
});

router.post('/check-phone', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  try {
    const user = await User.findOne({ phone });
    if (user) {
      return res.json({ success: false, message: 'Phone number already exists' });
    }
    return res.json({ success: true, message: 'Phone number is available' });
  } catch (error) {
    console.error('Error checking phone number:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

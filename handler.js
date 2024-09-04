const User = require("./schemas");
const Wallet = require("./walletSchema");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

dotenv.config();

/**
 * Handles the increase of user balances based on their daily profit, deposits, withdrawals, and product costs.
 */
async function handleIncreasingBalance() {
  try {
    const now = new Date();
    const users = await User.find();

    if (!users || users.length === 0) {
      console.log("No users found to process.");
      return;
    }

    await Promise.all(
      users.map(async (user) => {
        user.daily_profit = 0; // Initialize daily profit

        if (user.products && user.products.length > 0) {
          user.products.forEach((product) => {
            const diffTime = Math.abs(now - new Date(product.start));
            product.spent_days = Math.floor(diffTime / (1000 * 60 * 60 * 24)); // Calculate spent days
            product.got_profit =
              product.percentage * product.price * product.spent_days;
            product.got_percentage =
              (product.got_profit / product.total_profit) * 100;
            user.daily_profit += product.got_profit;
          });
        }

        const deposits = user.deposits.reduce((total, deposit) => {
          return deposit.status === 1 ? total + deposit.amount : total;
        }, 0);

        const withdrawals = user.widrawal_request.reduce(
          (total, withdrawal) => {
            return withdrawal.status !== 2 ? total + withdrawal.amount : total;
          },
          0
        );

        const pros_cost = user.products.reduce(
          (total, product) => total + product.price,
          0
        );

        // Update user balance
        user.balance =
          deposits +
          user.daily_profit -
          withdrawals -
          pros_cost +
          120 +
          user.invites_p;

        // Save the updated user document
        await user.save();
      })
    );

    console.log("All users' balances updated successfully.");
  } catch (error) {
    console.error(`Error updating users' balances: ${error.message}`);
  }
}

/**
 * UserClass provides various methods to manage user data, including creating, updating, and retrieving users.
 */
class UserClass {
  async create(data) {
    try {
      if (!data.password) {
        throw new Error("Password is required");
      }

      // Hash the password
      const saltRounds = parseInt(process.env.CRPTSALT, 10) || 10;
      data.password = await bcrypt.hash(data.password, saltRounds);

      const newUser = new User(data);
      return await newUser.save();
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      await handleIncreasingBalance();
      return await User.findById(id);
    } catch (error) {
      throw new Error(`Error finding user: ${error.message}`);
    }
  }

  async findAll() {
    try {
      await handleIncreasingBalance();
      return await User.find();
    } catch (error) {
      throw new Error(`Error finding users: ${error.message}`);
    }
  }

  async updateById(id, data) {
    try {
      return await User.findByIdAndUpdate(id, data, { new: true });
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  async updateItemById(id, item, value) {
    try {
      const user = await User.findById(id);
      user[item] = value;
      await user.save();
      return user;
    } catch (error) {
      throw new Error(`Error updating user item: ${error.message}`);
    }
  }

  async deleteById(id) {
    try {
      await User.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  async addProduct(id, product) {
    try {
      const user = await User.findById(id);
      user.products.push(product);
      await user.save();
    } catch (error) {
      throw new Error(`Error adding product: ${error.message}`);
    }
  }

  async increaseInvitesP(id, amount) {
    try {
      const user = await User.findById(id);
      user.invites_p += +amount;
      await user.save();
    } catch (error) {
      throw new Error(`Error increasing invites_p: ${error.message}`);
    }
  }

  async increaseInvitesQ(id, amount) {
    try {
      const user = await User.findById(id);
      user.invites_q += +amount;
      await user.save();
    } catch (error) {
      throw new Error(`Error increasing invites_q: ${error.message}`);
    }
  }

  async signIn(data) {
    try {
      const { phone, password } = data;

      if (!phone || !password) {
        throw new Error("Phone and password are required");
      }

      const user = await User.findOne({ phone });
      if (!user) {
        throw new Error("User not found");
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error("Invalid password");
      }

      const token = jwt.sign(
        { id: user._id, admin: user.admin },
        process.env.JWT_SECRETKEY,
        { expiresIn: "1h" }
      );

      return {
        success: true,
        message: "User signed in successfully",
        data: {
          user,
          token,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Error signing in: ${error.message}`,
      };
    }
  }

  async addDeposit(id, deposit) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error("User not found");
      }
      user.deposits.push(deposit);
      await user.save();
      return user;
    } catch (error) {
      throw new Error(`Error adding deposit: ${error.message}`);
    }
  }

  async changeWithdrawStatus(id, withdrawId, status) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error("User not found");
      }

      const withdraw = user.widrawal_request.id(withdrawId);
      if (!withdraw) {
        throw new Error("Withdrawal request not found");
      }

      withdraw.status = status;
      if (status === 1) {
        withdraw.success_date = new Date(); // Assuming status 1 means successful
      }
      await user.save();
      return user;
    } catch (error) {
      throw new Error(`Error changing withdrawal status: ${error.message}`);
    }
  }

  async changeDepositStatus(id, depositId, status) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error("User not found");
      }

      const deposit = user.deposits.id(depositId);
      if (!deposit) {
        throw new Error("Deposit not found");
      }

      deposit.status = status;
      await user.save();
      return user;
    } catch (error) {
      throw new Error(`Error changing deposit status: ${error.message}`);
    }
  }
}

/**
 * Formats a timestamp into a Cairo time string.
 * @param {string} timestamp - The timestamp to format.
 * @returns {string} The formatted time string.
 */
const formatCairoTime = (timestamp) => {
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  return `${parts[4].value}-${parts[2].value}-${parts[0].value} ${parts[6].value}:${parts[8].value} ${parts[10].value}`;
};

// /**
//  * Fetches and organizes data for the dashboard.
//  * @returns {object} The dashboard data.
//  */
// async function dashboardData() {
//   let data = {};
//   const statusOrder = {
//     Pending: 0,
//     Success: 1,
//     Failed: 2,
//   };
//   try {
//     const users = await User.find().lean();

//     // Fetch and format user data
//     const updatedUsers = await Promise.all(
//       users.map(async (u) => {
//         const fromUser = u.from ? await User.findById(u.from).lean() : null;
//         return {
//           id: u._id,
//           name: u.name || "Unknown",
//           invites_p: u.invites_p,
//           invites_q: u.invites_q,
//           phone: u.phone,
//           balance: u.balance,
//           daily_profit: u.daily_profit,
//           joined: formatCairoTime(u.joined),
//           products: u.products.length,
//           from: fromUser ? fromUser.name : "None",
//           wallet: `${u.wallet_name || "Unknown"}-${
//             u.wallet_number || "Unknown"
//           }`,
//         };
//       })
//     );

//     data.users = updatedUsers;

//     // Product distribution across users
//     const productsDist = users.reduce((acc, u) => {
//       u.products.forEach((p) => {
//         const existingProduct = acc.find((prod) => prod.name === p.name);
//         if (existingProduct) {
//           existingProduct.value += 1;
//         } else {
//           acc.push({ name: p.name, value: 1 });
//         }
//       });
//       return acc;
//     }, []);
//     let depositRequests = users.flatMap((u) =>
//       u.deposits.map((d) => ({
//         userId: u._id,
//         name: u.name,
//         amount: d.amount,
//         sentFrom: d.from,
//         sentTo: d.to,
//         depositId: d._id,
//         date: formatCairoTime(d.date),
//         status:
//           d.status == 1 ? "Success" : d.status == 2 ? "Failed" : "Pending",
//       }))
//     );
//     // Sort depositRequests based on the status value
//     depositRequests = depositRequests.sort((a, b) => {
//       return statusOrder[a.status] - statusOrder[b.status];
//     });

//     let withdrawalRequests = users.flatMap((u) =>
//       u.widrawal_request.map((w) => ({
//         userId: u._id,
//         name: u.name,
//         amount: w.amount,
//         sendTo: u.wallet_number || "Unknown",
//         withdrawalId: w._id,
//         date: formatCairoTime(w.start),
//         status:
//           w.status == 1 ? "Success" : w.status == 2 ? "Failed" : "Pending",
//       }))
//     );
//     withdrawalRequests = withdrawalRequests.sort((a, b) => {
//       return statusOrder[a.status] - statusOrder[b.status];
//     });

//     // Summary of financial data
//     const totalBalances = users.reduce((sum, u) => sum + u.balance, 0);
//     const totalDailyProfit = users.reduce((sum, u) => sum + u.daily_profit, 0);
//     const totalDeposits = users.reduce(
//       (sum, u) => sum + u.deposits.reduce((dsum, d) => dsum + d.amount, 0),
//       0
//     );
//     const totalDepositsSucc = users.reduce(
//       (sum, u) =>
//         sum +
//         u.deposits.reduce(
//           (dsum, d) => dsum + (d.status == 1 ? d.amount : 0),
//           0
//         ),
//       0
//     );
//     const totalWithdrawals = users.reduce(
//       (sum, u) =>
//         sum + u.widrawal_request.reduce((wsum, w) => wsum + w.amount, 0),
//       0
//     );
//     const totalWithdrawalsSucc = users.reduce(
//       (sum, u) =>
//         sum +
//         u.widrawal_request.reduce(
//           (wsum, w) => wsum + (w.status == 1 ? w.amount : 0),
//           0
//         ),
//       0
//     );
//     const totalInvites = users.reduce((sum, user) => sum + user.invites_q, 0);
//     const totalInvitesProfit = users.reduce(
//       (sum, user) => sum + user.invites_p,
//       0
//     );
//     // Calculate the daily increase in users
//     const today = new Date().setHours(0, 0, 0, 0);
//     const yesterday = new Date(today - 24 * 60 * 60 * 1000);
//     const dailyUserIncrease = users.filter(
//       (user) => new Date(user.joined) >= yesterday
//     ).length;

//     data.productsDist = productsDist;
//     data.totalBalances = totalBalances;
//     data.totalDailyProfit = totalDailyProfit;
//     data.totalDeposits = totalDeposits;
//     data.totalWithdrawals = totalWithdrawals;
//     data.totalInvitesProfit = totalInvitesProfit;
//     data.totalInvites = totalInvites;
//     data.dailyUserIncrease = dailyUserIncrease;
//     data.withdrawalRequests = withdrawalRequests;
//     data.depositRequests = depositRequests;
//     data.actualBalance = totalDepositsSucc - totalWithdrawalsSucc;
//   } catch (err) {
//     console.error(`Error fetching dashboard data: ${err.message}`);
//     data.error = err.message;
//   }
//   console.log(data);
//   return data;
// }

async function setActiveWallet(walletName) {
  try {
    // Deactivate all wallets
    await Wallet.updateMany({}, { active: false });

    // Activate the selected wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { name: walletName },
      { active: true },
      { new: true }
    );

    if (!updatedWallet) {
      throw new Error("Wallet not found");
    }

    console.log(`Set ${walletName} as active.`);
    return updatedWallet;
  } catch (error) {
    console.error(`Error setting active wallet: ${error.message}`);
    throw error;
  }
}
async function getActiveWallet() {
  const activeWallet = await Wallet.findOne({ "wallet.active": true });
  if (!activeWallet) {
    throw new Error("No active wallet found");
  }
  return activeWallet;
}

async function dashboardData() {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'from',
          foreignField: '_id',
          as: 'fromUser'
        }
      },
      {
        $unwind: {
          path: '$fromUser',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          id: "$_id",
          name: { $ifNull: ["$name", "Unknown"] },
          invites_p: 1,
          invites_q: 1,
          phone: 1,
          balance: 1,
          daily_profit: 1,
          joined: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$joined", timezone: "Africa/Cairo" } },
          products: { $size: "$products" },
          from: { $ifNull: ["$fromUser.name", "None"] },
          wallet: { $concat: [ { $ifNull: ["$wallet_name", "Unknown"] }, "-", { $ifNull: ["$wallet_number", "Unknown"] } ] }
        }
      }
    ]);
    const aggregationPipeline = [
      {
        $group: {
          _id: null,
          totalBalances: { $sum: "$balance" },
          totalDailyProfit: { $sum: "$daily_profit" },
          totalDepositsSucc: {
            $sum: {
              $sum: {
                $map: {
                  input: "$deposits",
                  as: "deposit",
                  in: { $cond: [{ $eq: ["$$deposit.status", 1] }, "$$deposit.amount", 0] }
                }
              }
            }
          },
          totalWithdrawalsSucc: {
            $sum: {
              $sum: {
                $map: {
                  input: "$widrawal_request",
                  as: "withdrawal",
                  in: { $cond: [{ $eq: ["$$withdrawal.status", 1] }, "$$withdrawal.amount", 0] }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalBalances: 1,
          totalDailyProfit: 1,
          totalDeposits: 1,
          totalDepositsSucc: 1,
          totalWithdrawals: 1,
          totalWithdrawalsSucc: 1
        }
      }
    ];

    // Perform the aggregation
    const summary = await User.aggregate(aggregationPipeline);

    // Retrieve pending deposit requests
    const depositRequests = await User.aggregate([
       // Unwind the deposits array to work with individual deposit documents
  { $unwind: "$deposits" },

  // Project the fields and format the date
  {
    $project: {
      userId: "$_id",
      name: 1,
      amount: "$deposits.amount",
      sentFrom: "$deposits.from",
      sentTo: "$deposits.to",
      depositId: "$deposits._id",
      date: {
        $dateToString: {
          format: "%Y-%m-%d %H:%M", // Format date to include AM/PM
          date: "$deposits.date",
          timezone: "Africa/Cairo" // Adjust timezone as needed
        }
      },
      status: {
        $switch: {
          branches: [
            { case: { $eq: ["$deposits.status", 0] }, then: "Pending" },
            { case: { $eq: ["$deposits.status", 1] }, then: "Success" },
            { case: { $eq: ["$deposits.status", 2] }, then: "Failed" }
          ],
          default: "Unknown" // Default case if status does not match
        }
      }
    }
  }
    ]);

    // Retrieve pending withdrawal requests
    const withdrawalRequests = await User.aggregate([
      // Unwind the widrawal_request array
      { $unwind: "$widrawal_request" },
    
      // Project the fields and format the date
      {
        $project: {
          userId: "$_id",
          name: 1,
          amount: "$widrawal_request.amount",
          sendTo: "$widrawal_request.to",
          withdrawalId: "$widrawal_request._id",
          date: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M", // Format date to include AM/PM
              date: "$widrawal_request.date",
              timezone: "Africa/Cairo" // Adjust timezone as needed
            }
          },
          status: {
            $switch: {
              branches: [
                { case: { $eq: ["$widrawal_request.status", 0] }, then: "Pending" },
                { case: { $eq: ["$widrawal_request.status", 1] }, then: "Success" },
                { case: { $eq: ["$widrawal_request.status", 2] }, then: "Failed" }
              ],
              default: "Unknown" // Default case if status does not match
            }
          }
        }
      }
    ]);
    // Format the response to match your original schema
    return {
      totalBalances: summary[0]?.totalBalances || 0,
      totalDailyProfit: summary[0]?.totalDailyProfit || 0,
      totalDepositsSucc: summary[0]?.totalDepositsSucc || 0,
      totalWithdrawalsSucc: summary[0]?.totalWithdrawalsSucc || 0,
      depositRequests,
      withdrawalRequests,
      users
    };
    
  } catch (error) {
    console.error(`Error fetching dashboard data: ${error.message}`);
    throw new Error(`Error fetching dashboard data: ${error.message}`);
  }
}

module.exports = {
  UserClass,
  handleIncreasingBalance,
  dashboardData,
  setActiveWallet,
  getActiveWallet,
};
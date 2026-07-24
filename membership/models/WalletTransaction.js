const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CounterBill",
      default: null,
    },
    createdBy: {
      type: String,
      enum: ["admin", "member", "system"],
      default: "system",
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
walletTransactionSchema.index({ memberId: 1, createdAt: -1 });

// Static method to create transaction and update wallet
walletTransactionSchema.statics.createTransaction = async function (data) {
  const Member = mongoose.model("Member");
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { memberId, type, amount, description, orderId, billId, createdBy, adminId, metadata } = data;

    // Get current member wallet balance
    const member = await Member.findById(memberId).session(session);
    if (!member) {
      throw new Error("Member not found");
    }

    const balanceBefore = member.walletBalance;
    let balanceAfter;

    if (type === "credit") {
      balanceAfter = balanceBefore + amount;
    } else if (type === "debit") {
      if (balanceBefore < amount) {
        throw new Error("Insufficient wallet balance");
      }
      balanceAfter = balanceBefore - amount;
    } else {
      throw new Error("Invalid transaction type");
    }

    // Create transaction record
    const transaction = await this.create(
      [
        {
          memberId,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          orderId,
          billId,
          createdBy,
          adminId,
          metadata,
        },
      ],
      { session }
    );

    // Update member wallet balance
    member.walletBalance = balanceAfter;
    await member.save({ session });

    await session.commitTransaction();
    session.endSession();

    return transaction[0];
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);

module.exports = WalletTransaction;

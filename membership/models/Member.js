const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const memberSchema = new mongoose.Schema(
  {
    memberNumber: {
      type: String,
      required: false, // Set by pre-save hook
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    profileImage: {
      type: String, // S3 URL or local path
      default: null,
    },
    documents: {
      aadhar: {
        type: String, // S3 URL
        default: null,
      },
      passport: {
        type: String, // S3 URL
        default: null,
      },
      pan: {
        type: String, // S3 URL (keeping for backward compatibility)
        default: null,
      },
    },
    membershipType: {
      type: String,
      enum: ["Member"],
      default: "Member",
    },
    qrCode: {
      type: String, // Base64 or URL
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validUntil: {
      type: Date,
      default: () => {
        // Default validity: 1 year from creation
        const date = new Date();
        date.setFullYear(date.getFullYear() + 1);
        return date;
      },
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Generate member number and hash password
memberSchema.pre("save", async function (next) {
  try {
    // Generate unique member number for new members
    if (this.isNew && !this.memberNumber) {
      const count = await this.constructor.countDocuments();
      this.memberNumber = `JKM${String(count + 1).padStart(6, "0")}`;
    }
    
    // Hash password if it's modified
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
memberSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to check if membership is valid
memberSchema.methods.isValidMembership = function () {
  return this.isActive && new Date() < this.validUntil;
};

// Virtual for full address
memberSchema.virtual("fullAddress").get(function () {
  if (!this.address) return "";
  const { street, city, state, zipCode, country } = this.address;
  return [street, city, state, zipCode, country]
    .filter(Boolean)
    .join(", ");
});

// Ensure virtuals are included in JSON
memberSchema.set("toJSON", { virtuals: true });
memberSchema.set("toObject", { virtuals: true });

const Member = mongoose.model("Member", memberSchema);

module.exports = Member;

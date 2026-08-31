const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Membership type prefixes for generating membership IDs
const MEMBERSHIP_PREFIXES = {
  "Life Member": "LM",
  "Temporary Member": "TM",
  "Special Temporary Member": "STM",
  "Honorary Member": "HM",
  "Senior Life Member": "SLM",
  "Institutional Member": "IM",
  "Platinum Member": "PM",
  "Affiliated Member": "AM",
};

const MEMBERSHIP_TYPES = [
  "Life Member",
  "Temporary Member",
  "Special Temporary Member",
  "Honorary Member",
  "Senior Life Member",
  "Institutional Member",
  "Platinum Member",
  "Affiliated Member",
  "Member", // backward compatibility
];

// Default discount percentage per membership type (used when member.discountPercentage is 0)
const DEFAULT_DISCOUNTS = {
  "Senior Life Member": 15,
  "Life Member": 10,
  "Platinum Member": 12,
  "Honorary Member": 20,
  "Institutional Member": 10,
  "Temporary Member": 5,
  "Special Temporary Member": 5,
  "Affiliated Member": 5,
  "Member": 0,
};

const memberSchema = new mongoose.Schema(
  {
    memberNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
    },
    membershipId: {
      // e.g. LMK-001 (prefix from type + first letter of name + serial)
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      // Not required for partial registration (admin creates without email)
      required: false,
      unique: true,
      sparse: true, // allows multiple null/undefined emails
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      // Not required for partial registration (member sets it later)
      required: false,
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
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
      enum: MEMBERSHIP_TYPES,
      default: "Member",
    },
    registrationStatus: {
      // "pending" = admin created partial entry, waiting for member to complete
      // "completed" = member has set password + uploaded docs
      type: String,
      enum: ["pending", "completed"],
      default: "completed",
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
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    monthlyServiceCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    resetOtp: {
      type: String,
      default: null,
    },
    resetOtpExpiry: {
      type: Date,
      default: null,
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
    fcmToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);
// Static: generate a membership ID based on type + name
// e.g. Life Member + "Kiran" → "LMK-001"
memberSchema.statics.generateMembershipId = async function (membershipType, name) {
  const prefix = MEMBERSHIP_PREFIXES[membershipType];
  if (!prefix) {
    throw new Error(`Unknown membership type: ${membershipType}`);
  }
  const firstLetter = (name || "X").charAt(0).toUpperCase();
  const basePrefix = `${prefix}${firstLetter}`;

  // Find the highest existing serial for this prefix
  const regex = new RegExp(`^${basePrefix}-(\\d+)$`);
  const existing = await this.find({ membershipId: regex })
    .select("membershipId")
    .lean();

  let maxSerial = 0;
  existing.forEach((m) => {
    const match = m.membershipId.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxSerial) maxSerial = num;
    }
  });

  const nextSerial = String(maxSerial + 1).padStart(3, "0");
  return `${basePrefix}-${nextSerial}`;
};

// Pre-save hook: Generate member number and hash password
memberSchema.pre("save", async function (next) {
  try {
    // Generate unique member number for new members
    if (this.isNew && !this.memberNumber) {
      const count = await this.constructor.countDocuments();
      this.memberNumber = `JKM${String(count + 1).padStart(6, "0")}`;
    }
    
    // Hash password if it's modified
    if (this.isModified("password") && this.password) {
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

// Method to get effective discount (per-member override > membership type default)
memberSchema.methods.getEffectiveDiscount = function () {
  if (this.discountPercentage > 0) return this.discountPercentage;
  return DEFAULT_DISCOUNTS[this.membershipType] || 0;
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


memberSchema.set("toJSON", { virtuals: true });
memberSchema.set("toObject", { virtuals: true });

const Member = mongoose.model("Member", memberSchema);

module.exports = Member;
module.exports.MEMBERSHIP_TYPES = MEMBERSHIP_TYPES;
module.exports.MEMBERSHIP_PREFIXES = MEMBERSHIP_PREFIXES;
module.exports.DEFAULT_DISCOUNTS = DEFAULT_DISCOUNTS;

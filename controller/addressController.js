const Address = require("../model/addressModel")
const User = require("../model/userModel")

// Get all addresses for a user
exports.getUserAddresses = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" })
    }

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 })

    res.status(200).json(addresses)
  } catch (error) {
    res.status(500).json({ message: "Error fetching addresses", error: error.message })
  }
}

// Add a new address
exports.addAddress = async (req, res) => {
  try {
    const { userId, type, address, isDefault } = req.body

    if (!userId || !type || !address) {
      return res.status(400).json({ message: "User ID, type, and address are required" })
    }

    // Check if user exists
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // If this is the first address, make it default
    const addressCount = await Address.countDocuments({ userId })
    const shouldBeDefault = isDefault || addressCount === 0

    const newAddress = new Address({
      userId,
      type,
      address,
      isDefault: shouldBeDefault,
    })

    await newAddress.save()

    res.status(201).json({ message: "Address added successfully", address: newAddress })
  } catch (error) {
    res.status(400).json({ message: "Error adding address", error: error.message })
  }
}

// Update an address
exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params
    const { type, address, isDefault } = req.body

    const updatedAddress = await Address.findByIdAndUpdate(
      id,
      { type, address, isDefault },
      { new: true, runValidators: true },
    )

    if (!updatedAddress) {
      return res.status(404).json({ message: "Address not found" })
    }

    res.status(200).json({ message: "Address updated successfully", address: updatedAddress })
  } catch (error) {
    res.status(400).json({ message: "Error updating address", error: error.message })
  }
}

// Delete an address
exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params

    const address = await Address.findByIdAndDelete(id)
    if (!address) {
      return res.status(404).json({ message: "Address not found" })
    }

    // If the deleted address was default, make another address default if available
    if (address.isDefault) {
      const anotherAddress = await Address.findOne({ userId: address.userId })
      if (anotherAddress) {
        anotherAddress.isDefault = true
        await anotherAddress.save()
      }
    }

    res.status(200).json({ message: "Address deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting address", error: error.message })
  }
}

// Set an address as default
exports.setDefaultAddress = async (req, res) => {
  try {
    const { id } = req.params

    const address = await Address.findById(id)
    if (!address) {
      return res.status(404).json({ message: "Address not found" })
    }

    // Update all addresses for this user to not be default
    await Address.updateMany({ userId: address.userId }, { $set: { isDefault: false } })

    // Set this address as default
    address.isDefault = true
    await address.save()

    res.status(200).json({ message: "Default address updated successfully", address })
  } catch (error) {
    res.status(500).json({ message: "Error setting default address", error: error.message })
  }
}
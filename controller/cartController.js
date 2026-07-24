const Cart = require("../model/cartModel");
const Menu = require("../model/menuModel");
const mongoose = require("mongoose");

// Get cart for a user and branch
exports.getCart = async (req, res) => {
  try {
    const { userId, branchId } = req.query;

    if (!userId || !branchId) {
      return res.status(400).json({ message: "User ID and Branch ID are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid User ID or Branch ID format" });
    }

    let cart = await Cart.findOne({ userId, branchId }).populate("branchId", "name address");

    if (!cart) {
      cart = {
        userId,
        branchId,
        items: [],
        totalPrice: 0,
      };
    }

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "Error fetching cart", error: error.message });
  }
};

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const { userId, branchId, menuItemId, quantity, price } = req.body;

    // Validate required fields
    if (!userId || !branchId || !menuItemId) {
      return res.status(400).json({ message: "User ID, Branch ID, and Menu Item ID are required" });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(menuItemId)
    ) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    // Find the menu item to get its details
    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Validate that the menu item belongs to the specified branch
    if (menuItem.branchId.toString() !== branchId.toString()) {
      return res.status(400).json({ message: "Menu item does not belong to the specified branch" });
    }

    // Check if cart exists for this user and branch
    let cart = await Cart.findOne({ userId, branchId });

    if (!cart) {
      // Create new cart if it doesn't exist
      cart = new Cart({
        userId,
        branchId,
        items: [],
      });
    }

    // Check if item already exists in cart
    const itemIndex = cart.items.findIndex((item) => item.menuItemId.toString() === menuItemId.toString());

    if (itemIndex > -1) {
      // Update quantity if item exists
      cart.items[itemIndex].quantity += quantity;
      
      // Update price if provided (in case subscription status changed)
      if (price !== undefined && price !== null && typeof price === 'number' && !isNaN(price)) {
        cart.items[itemIndex].price = price;

      }
    } else {
      // Use price from request if provided, otherwise fallback to menu item price
      let itemPrice = price;
      
      if (itemPrice === undefined || itemPrice === null) {
        // Fallback to menu item price
        itemPrice = menuItem.price;


        if ((itemPrice === undefined || itemPrice === null) && menuItem.prices && typeof menuItem.prices === 'object') {
          const priceValues = Object.values(menuItem.prices);

          itemPrice = priceValues.length > 0 ? Number(priceValues[0]) : 0;
        }
      }
      
      // Ensure price is a valid number, default to 1 if still invalid (to pass validation)
      const finalPrice = (typeof itemPrice === 'number' && !isNaN(itemPrice)) ? itemPrice : 1;

      // Add new item to cart
      cart.items.push({
        menuItemId,
        quantity,
        price: finalPrice,
        name: menuItem.name || menuItem.itemName || 'Unknown Item',
        image: menuItem.image || null,
      });
    }

    await cart.save();
    cart = await cart.populate("branchId", "name address");
    res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Error adding item to cart", error: error.message });
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { userId, branchId, menuItemId, quantity } = req.body;

    // Validate required fields
    if (!userId || !branchId || !menuItemId) {
      return res.status(400).json({ message: "User ID, Branch ID, and Menu Item ID are required" });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(menuItemId)
    ) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Validate quantity
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ message: "Quantity must be a non-negative integer" });
    }

    // Find the cart
    let cart = await Cart.findOne({ userId, branchId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find the menu item to validate branch
    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Validate that the menu item belongs to the specified branch
    if (menuItem.branchId.toString() !== branchId.toString()) {
      return res.status(400).json({ message: "Menu item does not belong to the specified branch" });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex((item) => item.menuItemId.toString() === menuItemId.toString());

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    cart = await cart.populate("branchId", "name address");
    res.status(200).json({ message: "Cart updated", cart });
  } catch (error) {
    res.status(500).json({ message: "Error updating cart", error: error.message });
  }
};

// Remove item from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { userId, branchId, menuItemId } = req.query;

    // Validate required fields
    if (!userId || !branchId || !menuItemId) {
      return res.status(400).json({ message: "User ID, Branch ID, and Menu Item ID are required" });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(branchId) ||
      !mongoose.Types.ObjectId.isValid(menuItemId)
    ) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Find the menu item to validate branch
    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Validate that the menu item belongs to the specified branch
    if (menuItem.branchId.toString() !== branchId.toString()) {
      return res.status(400).json({ message: "Menu item does not belong to the specified branch" });
    }

    // Find the cart
    const cart = await Cart.findOne({ userId, branchId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex((item) => item.menuItemId.toString() === menuItemId.toString());

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Remove item from cart
    cart.items.splice(itemIndex, 1);
    await cart.save();

    // Populate branch details
    await cart.populate("branchId", "name address");
    res.status(200).json({ message: "Item removed from cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Error removing item from cart", error: error.message });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const { userId, branchId } = req.query;

    // Validate required fields
    if (!userId || !branchId) {
      return res.status(400).json({ message: "User ID and Branch ID are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      return res.status(400).json({ message: "Invalid User ID or Branch ID format" });
    }

    const cart = await Cart.findOne({ userId, branchId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = [];
    await cart.save();

    await cart.populate("branchId", "name address");
    res.status(200).json({ message: "Cart cleared", cart });
  } catch (error) {
    res.status(500).json({ message: "Error clearing cart", error: error.message });
  }
};
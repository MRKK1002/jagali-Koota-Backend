/**
 * Full Menu Import Script for Jagali Koota
 * Drops existing categories, subcategories, menu items
 * Then creates fresh from the 20th August menu PDF
 * 
 * Run: node scripts/import-menu.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../model/Category');
const Menu = require('../model/menuModel');

// Try to load Subcategory model
let Subcategory;
try {
  Subcategory = require('../model/subcategoryModel');
} catch (e) {
  try {
    Subcategory = require('../model/Subcategory');
  } catch (e2) {
    console.log('⚠️  Subcategory model not found, will skip subcategories');
  }
}

const BRANCH_ID = '6a7d62cd765fc6fb713e911d';
const GST_RATE = 0;

// ─── MENU DATA ──────────────────────────────────────────────────────────────

const menuData = {
  "Continental": {
    subcategories: ["Soup", "Salad", "Starter", "Main Course", "Pasta Bar"],
    items: [
      // Soup
      { name: "Cream of Brocolli Almond Soup", price: 199, foodType: "veg", sub: "Soup" },
      { name: "Cream of Brocolli Almond Chicken Soup", price: 219, foodType: "non-veg", sub: "Soup" },
      // Salad
      { name: "Chakotha Kosambari Salad", price: 199, foodType: "veg", sub: "Salad" },
      { name: "Three Treasure Hummus Salad (Veg)", price: 249, foodType: "veg", sub: "Salad" },
      { name: "Three Treasure Hummus Salad (Chicken)", price: 299, foodType: "non-veg", sub: "Salad" },
      // Starter
      { name: "Garlic Bread (Plain)", price: 149, foodType: "veg", sub: "Starter" },
      { name: "Garlic Bread (Cheesy)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "French Fries (Salted)", price: 149, foodType: "veg", sub: "Starter" },
      { name: "French Fries (Peri Peri)", price: 199, foodType: "veg", sub: "Starter" },
      { name: "French Fries (Cheesy)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Peri Peri Popcorn (Paneer)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Peri Peri Popcorn (Chicken)", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Barbeque Chicken Wings", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Nachos (Veg)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Nachos (Chicken)", price: 299, foodType: "non-veg", sub: "Starter" },
      // Main Course
      { name: "Paneer Steak", price: 349, foodType: "veg", sub: "Main Course" },
      { name: "Butter Garlic Mushroom", price: 299, foodType: "veg", sub: "Main Course" },
      { name: "Butter Garlic Prawns", price: 449, foodType: "sea-food", sub: "Main Course" },
      { name: "Ajwain Fish Finger", price: 319, foodType: "sea-food", sub: "Main Course" },
      { name: "Prawn Gambas", price: 449, foodType: "sea-food", sub: "Main Course" },
      { name: "Chicken Stuffed Steak", price: 379, foodType: "non-veg", sub: "Main Course" },
      { name: "Thyme Roasted Chicken", price: 399, foodType: "non-veg", sub: "Main Course" },
      // Pasta Bar
      { name: "Pasta Bar (Sauteed Veggies)", price: 249, foodType: "veg", sub: "Pasta Bar" },
      { name: "Pasta Bar (Chicken)", price: 299, foodType: "non-veg", sub: "Pasta Bar" },
      { name: "Pasta Bar (Prawns)", price: 399, foodType: "sea-food", sub: "Pasta Bar" },
      { name: "Meatball with Spaghetti", price: 399, foodType: "non-veg", sub: "Pasta Bar" },
      { name: "Mac & Cheese", price: 379, foodType: "veg", sub: "Pasta Bar" },
    ]
  },
  "Pan-Asian": {
    subcategories: ["Soup", "Salad", "Sushi", "Bao", "Dim Sum", "Small Plates", "Main Course", "Rice & Noodles"],
    items: [
      // Soup
      { name: "Tom Kha (Veg)", price: 199, foodType: "veg", sub: "Soup" },
      { name: "Tom Kha (Chicken)", price: 219, foodType: "non-veg", sub: "Soup" },
      { name: "Tom Kha (Prawn)", price: 249, foodType: "sea-food", sub: "Soup" },
      { name: "Manchow Soup (Veg)", price: 199, foodType: "veg", sub: "Soup" },
      { name: "Manchow Soup (Chicken)", price: 219, foodType: "non-veg", sub: "Soup" },
      { name: "Manchow Soup (Prawns)", price: 249, foodType: "sea-food", sub: "Soup" },
      // Salad
      { name: "Raw Papaya Mango Salad (Veg)", price: 199, foodType: "veg", sub: "Salad" },
      { name: "Raw Papaya Mango Salad (Chicken)", price: 219, foodType: "non-veg", sub: "Salad" },
      { name: "Raw Papaya Mango Salad (Prawns)", price: 299, foodType: "sea-food", sub: "Salad" },
      // Sushi
      { name: "Jagali Koota Kapamaki (4 Pcs)", price: 299, foodType: "chef-special", sub: "Sushi" },
      { name: "Jagali Koota Kapamaki (8 Pcs)", price: 499, foodType: "chef-special", sub: "Sushi" },
      { name: "Crispy Asparagus Maki (4 Pcs)", price: 299, foodType: "veg", sub: "Sushi" },
      { name: "Crispy Asparagus Maki (8 Pcs)", price: 499, foodType: "veg", sub: "Sushi" },
      { name: "Chicken Katsu (4 Pcs)", price: 299, foodType: "non-veg", sub: "Sushi" },
      { name: "Chicken Katsu (8 Pcs)", price: 499, foodType: "non-veg", sub: "Sushi" },
      { name: "Sake Maki Salmon (4 Pcs)", price: 349, foodType: "sea-food", sub: "Sushi" },
      { name: "Sake Maki Salmon (8 Pcs)", price: 599, foodType: "sea-food", sub: "Sushi" },
      { name: "Rainbow Roll (4 Pcs)", price: 349, foodType: "sea-food", sub: "Sushi" },
      { name: "Rainbow Roll (8 Pcs)", price: 499, foodType: "sea-food", sub: "Sushi" },
      { name: "Avocado Nigri (5 Pcs)", price: 349, foodType: "veg", sub: "Sushi" },
      { name: "Avocado Nigri (7 Pcs)", price: 499, foodType: "veg", sub: "Sushi" },
      { name: "Crab Stick & Salmon Nigri (5 Pcs)", price: 369, foodType: "sea-food", sub: "Sushi" },
      { name: "Crab Stick & Salmon Nigri (7 Pcs)", price: 599, foodType: "sea-food", sub: "Sushi" },
      // Bao
      { name: "Asian Crispy Bao Veg (2 Pcs)", price: 249, foodType: "veg", sub: "Bao" },
      { name: "Crispy Chicken Tongarashi (2 Pcs)", price: 299, foodType: "non-veg", sub: "Bao" },
      // Dim Sum
      { name: "Spicy Cream Cheese Dumpling", price: 299, foodType: "veg", sub: "Dim Sum" },
      { name: "Chi Chow Veg", price: 299, foodType: "veg", sub: "Dim Sum" },
      { name: "Spicy Chicken Dumpling", price: 299, foodType: "non-veg", sub: "Dim Sum" },
      { name: "Chicken & Leek Dumpling", price: 299, foodType: "non-veg", sub: "Dim Sum" },
      { name: "Jolle Momo Chicken", price: 299, foodType: "non-veg", sub: "Dim Sum" },
      { name: "Steam Wonton Chilli Oil (Veg)", price: 299, foodType: "veg", sub: "Dim Sum" },
      { name: "Steam Wonton Chilli Oil (Chicken)", price: 299, foodType: "non-veg", sub: "Dim Sum" },
      // Small Plates
      { name: "Hot Mayo Baby Corn", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Water Chestnut Hot Mustard Mayo", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Asian Crispy Corn", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Kung Pao Paneer", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Kung Pao Chicken", price: 299, foodType: "non-veg", sub: "Small Plates" },
      { name: "Mongolian Paneer", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Mongolian Chicken", price: 299, foodType: "non-veg", sub: "Small Plates" },
      { name: "Chilli Mushroom", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Honey Chilli Lotus Stem", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Suicide Chicken Wings", price: 299, foodType: "non-veg", sub: "Small Plates" },
      { name: "Hunan Fish", price: 349, foodType: "sea-food", sub: "Small Plates" },
      { name: "Chilli Basil Chicken", price: 319, foodType: "non-veg", sub: "Small Plates" },
      { name: "Chilli Basil Squid", price: 349, foodType: "sea-food", sub: "Small Plates" },
      { name: "Prawn Bird Eye Chilli Oyster", price: 419, foodType: "sea-food", sub: "Small Plates" },
      { name: "Assorted Veg Hot Garlic", price: 299, foodType: "veg", sub: "Small Plates" },
      { name: "Stir Fry Asian Green", price: 299, foodType: "veg", sub: "Small Plates" },
      // Main Course
      { name: "Schezwan Chicken Sauce", price: 299, foodType: "non-veg", sub: "Main Course" },
      { name: "Chicken Five Spice Sauce", price: 299, foodType: "non-veg", sub: "Main Course" },
      { name: "Tempura Prawns", price: 399, foodType: "sea-food", sub: "Main Course" },
      { name: "Laksa (Veg)", price: 299, foodType: "veg", sub: "Main Course" },
      { name: "Laksa (Non Veg)", price: 349, foodType: "non-veg", sub: "Main Course" },
      // Rice & Noodles
      { name: "Udon Noodle with Heijiao (Veg)", price: 299, foodType: "veg", sub: "Rice & Noodles" },
      { name: "Udon Noodle with Heijiao (Egg)", price: 319, foodType: "egg", sub: "Rice & Noodles" },
      { name: "Udon Noodle with Heijiao (Chicken)", price: 349, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "Udon Noodle with Heijiao (Prawn)", price: 399, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "1990's Style Noodle (Veg)", price: 269, foodType: "veg", sub: "Rice & Noodles" },
      { name: "1990's Style Noodle (Egg)", price: 299, foodType: "egg", sub: "Rice & Noodles" },
      { name: "1990's Style Noodle (Chicken)", price: 319, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "1990's Style Noodle (Prawn)", price: 349, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "1990's Style Rice (Veg)", price: 269, foodType: "veg", sub: "Rice & Noodles" },
      { name: "1990's Style Rice (Egg)", price: 299, foodType: "egg", sub: "Rice & Noodles" },
      { name: "1990's Style Rice (Chicken)", price: 319, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "1990's Style Rice (Prawn)", price: 349, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "Classic Chinese Fried Rice (Veg)", price: 269, foodType: "veg", sub: "Rice & Noodles" },
      { name: "Classic Chinese Fried Rice (Egg)", price: 299, foodType: "egg", sub: "Rice & Noodles" },
      { name: "Classic Chinese Fried Rice (Chicken)", price: 319, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "Classic Chinese Fried Rice (Prawn)", price: 349, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "Thai Green Curry (Veg)", price: 299, foodType: "veg", sub: "Rice & Noodles" },
      { name: "Thai Green Curry (Chicken)", price: 349, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "Thai Green Curry (Prawns)", price: 449, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "Thai Red Curry (Veg)", price: 299, foodType: "veg", sub: "Rice & Noodles" },
      { name: "Thai Red Curry (Chicken)", price: 349, foodType: "non-veg", sub: "Rice & Noodles" },
      { name: "Thai Red Curry (Prawns)", price: 449, foodType: "sea-food", sub: "Rice & Noodles" },
      { name: "Jasmine Steam Rice", price: 199, foodType: "veg", sub: "Rice & Noodles" },
    ]
  },
  "Naati Style": {
    subcategories: ["Soup", "Salad", "Starter", "Curries", "Biryani", "Rice"],
    items: [
      // Soup
      { name: "Drumstick Dal Soup", price: 199, foodType: "veg", sub: "Soup" },
      { name: "Kaal Soup", price: 199, foodType: "non-veg", sub: "Soup" },
      // Salad
      { name: "Green Salad", price: 169, foodType: "veg", sub: "Salad" },
      // Starter
      { name: "Veg Club Special", price: 299, foodType: "veg", sub: "Starter" },
      { name: "Pepper Dry (Mushroom)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Pepper Dry (Baby Corn)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Pepper Dry (Paneer)", price: 249, foodType: "veg", sub: "Starter" },
      { name: "Mushroom Jeera", price: 239, foodType: "veg", sub: "Starter" },
      { name: "Mushroom Curry Leaf Kabab", price: 239, foodType: "veg", sub: "Starter" },
      { name: "Pepper Dry (Egg)", price: 199, foodType: "egg", sub: "Starter" },
      { name: "Pepper Dry (Chicken)", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Pepper Dry (Mutton)", price: 349, foodType: "non-veg", sub: "Starter" },
      { name: "Pepper Dry (Thale Mamsa)", price: 269, foodType: "non-veg", sub: "Starter" },
      { name: "Ghee Roast Dry (Paneer)", price: 299, foodType: "veg", sub: "Starter" },
      { name: "Ghee Roast Dry (Egg)", price: 199, foodType: "egg", sub: "Starter" },
      { name: "Ghee Roast Dry (Chicken)", price: 319, foodType: "non-veg", sub: "Starter" },
      { name: "Ghee Roast Dry (Mutton)", price: 449, foodType: "non-veg", sub: "Starter" },
      { name: "Egg Burji", price: 139, foodType: "egg", sub: "Starter" },
      { name: "Egg Kheema", price: 199, foodType: "egg", sub: "Starter" },
      { name: "Chicken Baagh", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Chicken Guntur (Bone)", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Chicken Guntur (Boneless)", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Chicken Lollipop", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Coorg Chicken", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Chicken Fry", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Chops (Chicken)", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Chops (Nati Koli)", price: 349, foodType: "non-veg", sub: "Starter" },
      { name: "Chops (Mutton)", price: 349, foodType: "non-veg", sub: "Starter" },
      { name: "Chicken Kabab", price: 249, foodType: "non-veg", sub: "Starter" },
      { name: "Naati Koli Fry", price: 349, foodType: "non-veg", sub: "Starter" },
      { name: "Thale Mamsa Fry", price: 269, foodType: "non-veg", sub: "Starter" },
      { name: "Anjal Fry (Tawa/Rawa/Masala)", price: 449, foodType: "sea-food", sub: "Starter" },
      { name: "Kheema Dry", price: 319, foodType: "non-veg", sub: "Starter" },
      { name: "Kheema Fry Smash", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Mutton Kheema Egg Dry", price: 319, foodType: "non-veg", sub: "Starter" },
      { name: "Pomfret Fry (Tawa/Rawa/Masala)", price: 599, foodType: "sea-food", sub: "Starter" },
      { name: "Mutton Bandli Fry", price: 349, foodType: "non-veg", sub: "Starter" },
      // Curries
      { name: "Dal Fry", price: 249, foodType: "veg", sub: "Curries" },
      { name: "Dal Fry + Whisky Tadka", price: 349, foodType: "veg", sub: "Curries" },
      { name: "Naati Koli Saaru", price: 349, foodType: "non-veg", sub: "Curries" },
      { name: "Kheema Saaru", price: 269, foodType: "non-veg", sub: "Curries" },
      { name: "Thale Mamsa Saaru", price: 269, foodType: "non-veg", sub: "Curries" },
      // Biryani
      { name: "Veg Biryani", price: 249, foodType: "veg", sub: "Biryani" },
      { name: "Egg Biryani", price: 259, foodType: "egg", sub: "Biryani" },
      { name: "Chicken Biryani", price: 259, foodType: "non-veg", sub: "Biryani" },
      { name: "Mutton Biryani", price: 399, foodType: "non-veg", sub: "Biryani" },
      // Rice
      { name: "Palak Rice", price: 199, foodType: "veg", sub: "Rice" },
      { name: "Special Curd Rice", price: 199, foodType: "veg", sub: "Rice" },
      { name: "Dal Khichdi", price: 229, foodType: "veg", sub: "Rice" },
    ]
  },
  "Tandoor": {
    subcategories: ["Starter", "Rotis and Bread"],
    items: [
      // Starter
      { name: "Mosru Kebab", price: 299, foodType: "veg", sub: "Starter" },
      { name: "Khumb Khazana", price: 289, foodType: "veg", sub: "Starter" },
      { name: "Malai Broccoli", price: 299, foodType: "veg", sub: "Starter" },
      { name: "Paneer Stuffed Tikka", price: 299, foodType: "veg", sub: "Starter" },
      { name: "Tandoor Grilled Chicken (Half)", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Tandoor Grilled Chicken (Full)", price: 499, foodType: "non-veg", sub: "Starter" },
      { name: "Classic Chicken Tikka", price: 299, foodType: "non-veg", sub: "Starter" },
      { name: "Kalmi Stuffed Kebab", price: 349, foodType: "non-veg", sub: "Starter" },
      { name: "Fish Tikka", price: 399, foodType: "sea-food", sub: "Starter" },
      { name: "Tandoori Sriracha Prawns", price: 499, foodType: "sea-food", sub: "Starter" },
      // Rotis and Bread
      { name: "Tandoori Roti (Plain)", price: 79, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Tandoori Roti (Butter)", price: 89, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Naan (Plain)", price: 89, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Naan (Butter)", price: 99, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Naan (Garlic)", price: 99, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Lacha Paratha (Plain/Ghee)", price: 99, foodType: "veg", sub: "Rotis and Bread" },
      { name: "Chilli Cheese Garlic Naan", price: 119, foodType: "veg", sub: "Rotis and Bread" },
    ]
  },
  "Dessert": {
    subcategories: [],
    items: [
      { name: "Milk Pudding", price: 199, foodType: "veg", sub: null },
      { name: "Honey Darsun with Ice Cream", price: 199, foodType: "veg", sub: null },
      { name: "Mysore Pak Pan Pack", price: 249, foodType: "veg", sub: null },
      { name: "Pan Fried Banana Cake with Vanilla Ice Cream", price: 199, foodType: "veg", sub: null },
      { name: "Homemade Ice Cream (Per Scoop)", price: 99, foodType: "veg", sub: null },
    ]
  },
  "Jagali Sips": {
    subcategories: ["Mocktails", "Milkshake"],
    items: [
      // Mocktails
      { name: "Fruit Punch", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Beetroot Citrus Juice", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Cucumber Mint Cooler", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Watermelon Mint Smash", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Spicy Guava", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "The Kafir Cran", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Chilli Citrus", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Virgin Mojito (Cranberry)", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Virgin Mojito (Orange)", price: 199, foodType: "veg", sub: "Mocktails" },
      { name: "Virgin Hot Toddy", price: 199, foodType: "veg", sub: "Mocktails" },
      // Milkshake
      { name: "Oreo Milkshake", price: 219, foodType: "veg", sub: "Milkshake" },
      { name: "Avocado Milkshake", price: 219, foodType: "veg", sub: "Milkshake" },
      { name: "Banana Milkshake", price: 219, foodType: "veg", sub: "Milkshake" },
    ]
  }
};

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/HotelVirat';
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected');

  // 1. DROP existing data
  console.log('\n🗑️  Dropping existing menu items...');
  const deletedItems = await Menu.deleteMany({});
  console.log(`   Deleted ${deletedItems.deletedCount} menu items`);

  if (Subcategory) {
    console.log('🗑️  Dropping existing subcategories...');
    const deletedSubs = await Subcategory.deleteMany({});
    console.log(`   Deleted ${deletedSubs.deletedCount} subcategories`);
  }

  console.log('🗑️  Dropping existing categories...');
  const deletedCats = await Category.deleteMany({});
  console.log(`   Deleted ${deletedCats.deletedCount} categories`);

  // 2. CREATE categories, subcategories, and items
  let totalItems = 0;

  for (const [catName, catData] of Object.entries(menuData)) {
    console.log(`\n📂 Creating category: ${catName}`);
    const category = await Category.create({
      name: catName,
      branchId: BRANCH_ID,
      branch: { id: BRANCH_ID, name: 'MYSURU', address: 'Mysuru, Karnataka' },
      gstRate: GST_RATE,
    });
    console.log(`   ✓ Category ID: ${category._id}`);

    // Create subcategories
    const subMap = {};
    if (Subcategory && catData.subcategories.length > 0) {
      for (const subName of catData.subcategories) {
        const sub = await Subcategory.create({
          name: subName,
          categoryId: category._id,
          branchId: BRANCH_ID,
          description: subName,
        });
        subMap[subName] = sub._id;
        console.log(`   📁 Subcategory: ${subName} (${sub._id})`);
      }
    }

    // Create menu items
    for (const item of catData.items) {
      await Menu.create({
        name: item.name,
        price: item.price,
        foodType: item.foodType,
        gstRate: GST_RATE,
        categoryId: category._id,
        subcategoryId: item.sub && subMap[item.sub] ? subMap[item.sub] : null,
        branchId: BRANCH_ID,
        isActive: true,
        stock: 100,
      });
      totalItems++;
    }
    console.log(`   ✓ Added ${catData.items.length} items`);
  }

  console.log(`\n🎉 DONE! Total items created: ${totalItems}`);
  console.log('   Categories: ' + Object.keys(menuData).length);

  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

/**
 * Fix menu items: assign correct categoryId, subcategoryId, and foodType
 * based on item names and known classification rules.
 *
 * Run: node scripts/fix-menu-categories.js
 */
require("dotenv").config()
const mongoose = require("mongoose")
const Menu = require("../model/menuModel")
const Category = require("../model/Category")
const Subcategory = require("../model/subcategoryModel")

// ─── Classification rules ─────────────────────────────────────────────────────

// Keywords to classify items into categories
const NAATI_KEYWORDS = [
  "akki roti", "ragi", "jolada", "bisi bele", "chitranna", "curd rice",
  "coconut rice", "lemon rice", "tomato rice", "puliyogare", "enne holige",
  "holige", "obbattu", "chapati", "dosa", "idli", "vada", "upma",
  "kesari bath", "avalakki", "paddu", "neer dosa", "set dosa",
  "masala dosa", "rava dosa", "uttapam", "pongal", "sambar rice",
  "rasam rice", "mosaru vade", "mysore pak", "payasa", "kheer",
]

const TANDOORI_KEYWORDS = [
  "tandoori", "kebab", "tikka", "naan", "butter naan", "cheese naan",
  "garlic naan", "roti", "paratha", "kulcha", "seekh", "malai",
  "boti", "reshmi", "hariyali", "afghani", "shawarma", "paneer tikka",
]

const PAN_ASIAN_KEYWORDS = [
  "noodles", "fried rice", "manchurian", "dragon", "dim sum", "spring roll",
  "momos", "chilli chicken", "chilli paneer", "chilli fish", "crispy corn",
  "schezwan", "szechuan", "hakka", "thai", "basil", "burnt garlic",
  "gobi manchurian", "baby corn", "hot and sour", "wonton",
  "kung pao", "sweet and sour", "teriyaki", "sushi", "ramen",
  "pad thai", "satay", "tempura", "lollipop", "65",
  "chicken 65", "paneer 65", "gobi 65",
]

const DRINKS_KEYWORDS = [
  // Alcoholic
  "kingfisher", "budweiser", "heineken", "corona", "carlsberg", "tuborg",
  "bira", "belgian", "old monk", "bacardi", "captain morgan", "absolut",
  "smirnoff", "grey goose", "bombay sapphire", "tanqueray", "hendricks",
  "jack daniel", "johnnie walker", "chivas", "jameson", "glenfiddich",
  "jagermeister", "baileys", "kahlua", "tequila", "vodka", "whisky",
  "whiskey", "rum", "gin", "wine", "beer", "champagne", "cocktail",
  "mojito", "margarita", "cosmopolitan", "long island", "martini",
  "sangria", "piña colada", "daiquiri", "negroni", "old fashioned",
  // Non-alcoholic beverages
  "chai", "tea", "coffee", "latte", "cappuccino", "espresso", "americano",
  "mocha", "macchiato", "cold coffee", "iced tea", "iced coffee",
  "lassi", "buttermilk", "chaas", "jaljeera", "nimbu pani",
  "lemonade", "lime soda", "fresh lime", "juice", "smoothie",
  "milkshake", "shake", "soda", "cola", "tonic", "water",
  "coconut water", "badam milk", "thandai", "sherbet", "squash",
  "blue lagoon", "virgin", "mocktail", "berry blast", "mint cooler",
  "chamomile", "green tea", "herbal tea",
]

// Items that are definitely non-veg
const NON_VEG_KEYWORDS = [
  "chicken", "mutton", "lamb", "fish", "prawn", "shrimp", "crab",
  "lobster", "squid", "calamari", "meat", "pork", "beef", "bacon",
  "sausage", "salami", "ham", "turkey", "duck", "quail", "rabbit",
  "keema", "gosht", "murgh", "murg", "jhinga", "machli", "machi",
  "tikka chicken", "butter chicken", "tandoori chicken", "bbq ribs",
  "seekh kebab", "boti kebab", "reshmi kebab",
]

// Items that are egg-based
const EGG_KEYWORDS = [
  "egg biryani", "egg fried rice", "egg noodles", "egg curry",
  "egg roll", "egg paratha", "omelette", "omelet", "scrambled egg",
  "boiled egg", "egg bhurji", "anda",
]

// Items that are definitely veg
const VEG_KEYWORDS = [
  "paneer", "aloo", "gobi", "dal", "palak", "bhindi", "baingan",
  "mushroom", "tofu", "soya", "rajma", "chole", "chana", "kadai veg",
  "veg biryani", "veg fried rice", "veg noodles", "veg manchurian",
  "veg burger", "veg soup", "veg roll", "veg sandwich",
  "plain dosa", "masala dosa", "idli", "vada", "upma", "pongal",
  "naan", "roti", "paratha", "chapati", "kulcha", "bhature",
  "rice", "raita", "papad", "pickle", "salad", "coleslaw",
  "gulab jamun", "rasmalai", "kheer", "halwa", "jalebi", "brownie",
  "cake", "ice cream", "fruit", "mysore pak", "payasa", "holige",
  "fries", "wedges", "nachos", "bruschetta", "garlic bread",
  "spring roll veg", "crispy corn", "baby corn",
]

function classifyCategory(name) {
  const lower = name.toLowerCase().trim()

  // Check Drinks first (alcohol + beverages)
  for (const kw of DRINKS_KEYWORDS) {
    if (lower.includes(kw)) return "Drinks"
  }

  // Check Pan-Asian
  for (const kw of PAN_ASIAN_KEYWORDS) {
    if (lower.includes(kw)) return "Pan-Asian"
  }

  // Check Tandoori
  for (const kw of TANDOORI_KEYWORDS) {
    if (lower.includes(kw)) return "Tandoori"
  }

  // Check Naati
  for (const kw of NAATI_KEYWORDS) {
    if (lower.includes(kw)) return "Naati"
  }

  // Default: Conti Kitchen (North Indian, Continental, etc.)
  return "Conti Kitchen"
}

function classifyFoodType(name) {
  const lower = name.toLowerCase().trim()

  // Drinks don't have a food type — mark as veg by default
  for (const kw of DRINKS_KEYWORDS) {
    if (lower.includes(kw)) return "veg"
  }

  // Check egg first (before non-veg, since "egg biryani" contains no meat keyword)
  for (const kw of EGG_KEYWORDS) {
    if (lower.includes(kw)) return "egg"
  }

  // Check non-veg
  for (const kw of NON_VEG_KEYWORDS) {
    if (lower.includes(kw)) return "non-veg"
  }

  // Default to veg
  return "veg"
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log("Connected to MongoDB")

  // Load categories
  const categories = await Category.find().lean()
  const catMap = {}
  categories.forEach(c => { catMap[c.name] = c._id })
  console.log("Categories:", Object.keys(catMap).join(", "))

  // Load subcategories
  const subcategories = await Subcategory.find().lean()
  const subcatByCat = {}
  subcategories.forEach(s => {
    const catId = String(s.categoryId)
    if (!subcatByCat[catId]) subcatByCat[catId] = []
    subcatByCat[catId].push(s)
  })
  console.log("Subcategories:", subcategories.map(s => s.name).join(", ") || "(none)")

  // Load all menu items
  const items = await Menu.find().lean()
  console.log("\nTotal items:", items.length)

  // Track stats
  const stats = { updated: 0, categoryChanged: 0, foodTypeSet: 0, errors: 0 }
  const categoryCount = {}

  for (const item of items) {
    const name = item.name || item.itemName || ""
    if (!name) continue

    const targetCatName = classifyCategory(name)
    const targetCatId = catMap[targetCatName]
    const foodType = classifyFoodType(name)

    if (!targetCatId) {
      console.warn("  WARN: No category found for:", targetCatName)
      stats.errors++
      continue
    }

    // Track category distribution
    categoryCount[targetCatName] = (categoryCount[targetCatName] || 0) + 1

    // Check if update is needed
    const needsCategoryUpdate = String(item.categoryId) !== String(targetCatId)
    const needsFoodType = !item.foodType || item.foodType !== foodType

    if (needsCategoryUpdate || needsFoodType) {
      const update = {}
      if (needsCategoryUpdate) {
        update.categoryId = targetCatId
        stats.categoryChanged++
      }
      if (needsFoodType) {
        update.foodType = foodType
        stats.foodTypeSet++
      }

      await Menu.updateOne({ _id: item._id }, { $set: update })
      stats.updated++
    }
  }

  console.log("\n--- Results ---")
  console.log("Items updated:", stats.updated)
  console.log("Category reassigned:", stats.categoryChanged)
  console.log("FoodType set:", stats.foodTypeSet)
  console.log("Errors:", stats.errors)
  console.log("\nCategory distribution:")
  Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log("  " + cat + ": " + count)
  })

  await mongoose.disconnect()
  console.log("\nDone!")
}

main().catch(e => {
  console.error("FATAL:", e.message)
  process.exit(1)
})

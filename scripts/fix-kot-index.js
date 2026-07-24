const mongoose = require("mongoose")
require("dotenv").config()

const fixKotIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("✅ MongoDB connected to:", process.env.MONGO_URI.split('@')[1].split('?')[0])

    const db = mongoose.connection.db
    const collection = db.collection("stafforders")

    console.log("\n📋 Current indexes on stafforders:")
    const indexes = await collection.indexes()
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${index.unique ? ' (UNIQUE)' : ''}`)
    })

    // Drop kotNumber_1 index if it exists
    const kotIndexExists = indexes.some(index => index.name === "kotNumber_1")
    
    if (kotIndexExists) {
      console.log("\n🗑️  Dropping kotNumber_1 unique index...")
      await collection.dropIndex("kotNumber_1")
      console.log("✅ Successfully dropped kotNumber_1 index")
    } else {
      console.log("\nℹ️  kotNumber_1 index does not exist")
    }

    // Also check for compound unique index with kotNumber
    console.log("\n🔍 Checking for compound indexes with kotNumber...")
    for (const index of indexes) {
      if (index.key && index.key.kotNumber !== undefined && index.unique && index.name !== '_id_') {
        console.log(`\n🗑️  Found unique index with kotNumber: ${index.name}`)
        try {
          await collection.dropIndex(index.name)
          console.log(`✅ Dropped: ${index.name}`)
        } catch (error) {
          console.error(`❌ Error dropping ${index.name}:`, error.message)
        }
      }
    }

    console.log("\n📋 Final indexes:")
    const finalIndexes = await collection.indexes()
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${index.unique ? ' (UNIQUE)' : ''}`)
    })

    console.log("\n✅ Done! Restart the backend server now.")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error:", error)
    process.exit(1)
  }
}

fixKotIndex()

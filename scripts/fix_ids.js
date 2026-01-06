const fs = require('fs')
const path = require('path')

// Setup paths similar to build_groups.js
const ROOT_DIR = path.resolve(__dirname, '..')
const ZH_CN_DIR = path.join(ROOT_DIR, 'zh-CN')

// Get filename from command line arguments
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error(
    'Error: Please provide a filename (e.g., site-linux.do-my.json)'
  )
  process.exit(1)
}

const fileName = args[0]
// Handle case where user might provide full path or just filename
const baseName = path.basename(fileName)
const filePath = path.join(ZH_CN_DIR, baseName)

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found at ${filePath}`)
  process.exit(1)
}

console.log(`Processing file: ${filePath}`)

try {
  const content = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(content)

  function generateId() {
    return Math.random().toString(36).substring(2, 10)
  }

  let count = 0
  if (data.items) {
    data.items.forEach((item) => {
      item.id = generateId()
      count++
    })
  }

  // Preserve final newline
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`Successfully regenerated IDs for ${count} items.`)
} catch (e) {
  console.error('Error processing file:', e)
  process.exit(1)
}

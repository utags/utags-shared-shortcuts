const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

console.log('Script started')

const ROOT_DIR = path.resolve(__dirname, '..')
const ZH_CN_DIR = path.join(ROOT_DIR, 'zh-CN')
const COLLECTIONS_DIR = path.join(ZH_CN_DIR, 'collections')
const CONFIG_FILE = path.join(ZH_CN_DIR, 'config.yml')

console.log('Collections Dir:', COLLECTIONS_DIR)

// Ensure output directory exists
if (!fs.existsSync(COLLECTIONS_DIR)) {
  console.log('Creating directory...')
  fs.mkdirSync(COLLECTIONS_DIR, { recursive: true })
} else {
  console.log('Directory exists.')
}

try {
  // Read config.yml
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8')
  const config = yaml.load(configContent)

  if (!config) {
    console.error('Error: config.yml is empty or invalid.')
    process.exit(1)
  }

  // Iterate over each collection key in config
  for (const collectionName of Object.keys(config)) {
    const configItem = config[collectionName]

    // Normalize input: support both array (legacy) and object with groups property
    let groupList = []
    let meta = {}

    if (Array.isArray(configItem)) {
      groupList = configItem
    } else if (configItem && Array.isArray(configItem.groups)) {
      groupList = configItem.groups
      meta = {
        name: configItem.name,
        description: configItem.description,
      }
    } else {
      console.warn(
        `Warning: Key "${collectionName}" is not a valid collection configuration. Skipping.`
      )
      continue
    }

    console.log(`Processing collection: ${collectionName}`)
    const groups = []

    // Iterate over each group in the current collection
    for (const groupName of groupList) {
      const groupFile = path.join(ZH_CN_DIR, `${groupName}.json`)

      if (fs.existsSync(groupFile)) {
        try {
          const groupContent = fs.readFileSync(groupFile, 'utf8')
          const groupData = JSON.parse(groupContent)
          groups.push(groupData)
          console.log(`  Loaded: ${groupName}.json`)
        } catch (e) {
          console.error(`  Error reading or parsing ${groupName}.json:`, e)
        }
      } else {
        console.warn(`  Warning: File not found: ${groupName}.json`)
      }
    }

    // Create aggregated object
    const aggregatedData = {
      ...meta, // Include optional name and description
      groups: groups,
    }

    // Write to output file
    const outputFile = path.join(COLLECTIONS_DIR, `${collectionName}.json`)
    fs.writeFileSync(
      outputFile,
      JSON.stringify(aggregatedData, null, 2) + '\n',
      'utf8'
    )

    console.log(`  Successfully generated aggregated file at: ${outputFile}`)
    console.log(`  Total groups aggregated: ${groups.length}`)
    console.log('---')
  }
} catch (e) {
  console.error('Error processing groups:', e)
  process.exit(1)
}

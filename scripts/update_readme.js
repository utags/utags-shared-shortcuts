const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const yaml = require('js-yaml')

const ROOT_DIR = path.resolve(__dirname, '..')
const ZH_CN_DIR = path.join(ROOT_DIR, 'zh-CN')
const COLLECTIONS_DIR = path.join(ZH_CN_DIR, 'collections')
const CONFIG_FILE = path.join(ZH_CN_DIR, 'config.yml')
const README_FILE = path.join(ZH_CN_DIR, 'README.md')

// Helper to calculate items count in a group
function getShortcutsCount(group) {
  if (!group || !group.items) return 0
  return group.items.length
}

// Helper to calculate total items in a collection
function getCollectionShortcutsCount(collection) {
  if (!collection || !collection.groups) return 0
  return collection.groups.reduce(
    (sum, group) => sum + getShortcutsCount(group),
    0
  )
}

// Helper to format date object to YYYY-MM-DD HH:mm +ZZZZ
function formatDate(date) {
  const pad = (n) => (n < 10 ? '0' + n : n)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const absOffset = Math.abs(offset)
  const offHours = pad(Math.floor(absOffset / 60))
  const offMins = pad(absOffset % 60)

  return `${year}-${month}-${day} ${hours}:${minutes} ${sign}${offHours}${offMins}`
}

// Helper to get file modification date using git
function getFileDate(filePath) {
  try {
    const cmd = `git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M %z' "${filePath}"`
    const date = execSync(cmd, { encoding: 'utf8' }).trim()
    if (date) return date

    const stats = fs.statSync(filePath)
    return formatDate(stats.mtime)
  } catch (e) {
    // console.error(`Error getting git date for ${filePath}`, e.message)
    try {
      const stats = fs.statSync(filePath)
      return formatDate(stats.mtime)
    } catch (e2) {
      return formatDate(new Date())
    }
  }
}

try {
  // Read config.yml
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8')
  const config = yaml.load(configContent)

  if (!config) {
    console.error('Error: config.yml is empty or invalid.')
    process.exit(1)
  }

  // 1. Generate Single Groups Table
  const singleGroups = []

  // Collect all unique groups referenced in config
  const allReferencedGroups = new Set()
  Object.values(config).forEach((item) => {
    // Support both array and object format
    const list = Array.isArray(item) ? item : item.groups || []
    if (Array.isArray(list)) {
      list.forEach((g) => allReferencedGroups.add(g))
    }
  })

  for (const groupName of allReferencedGroups) {
    const groupFile = path.join(ZH_CN_DIR, `${groupName}.json`)
    if (fs.existsSync(groupFile)) {
      try {
        const content = fs.readFileSync(groupFile, 'utf8')
        const data = JSON.parse(content)
        singleGroups.push({
          filename: `${groupName}.json`,
          name: data.name || groupName,
          count: getShortcutsCount(data),
          date: getFileDate(groupFile),
          rawUrl: `[Raw](https://raw.githubusercontent.com/utags/utags-shared-shortcuts/main/zh-CN/${groupName}.json)`,
        })
      } catch (e) {
        console.error(`Error parsing ${groupName}.json`, e)
      }
    }
  }

  // Sort single groups by filename or name if preferred
  singleGroups.sort((a, b) => a.filename.localeCompare(b.filename))

  let singleTable =
    '| 分组名 | 文件名 | shortcuts 个数 | 最后更新时间 | 下载链接 |\n'
  singleTable += '| :--- | :--- | :---: | :---: | :--- |\n'
  singleGroups.forEach((row) => {
    const fileLink = `[${row.filename}](https://github.com/utags/utags-shared-shortcuts/blob/main/zh-CN/${row.filename})`
    singleTable += `| ${row.name} | ${fileLink} | ${row.count} | ${row.date} | ${row.rawUrl} |\n`
  })

  // 2. Generate Collections Table
  const collectionRows = []
  for (const collectionName of Object.keys(config)) {
    const collectionFile = path.join(COLLECTIONS_DIR, `${collectionName}.json`)
    if (fs.existsSync(collectionFile)) {
      try {
        const content = fs.readFileSync(collectionFile, 'utf8')
        const data = JSON.parse(content)

        const configItem = config[collectionName]
        const includedGroups = Array.isArray(configItem)
          ? configItem
          : configItem.groups || []

        // Use name/desc from config if available, fallback to data or defaults
        const displayName =
          (configItem && configItem.name) || data.name || collectionName
        const displayDesc =
          (configItem && configItem.description) || data.description || ''

        const includedGroupsStr = includedGroups
          .map((g) => `\`${g}\``)
          .join(', ')

        collectionRows.push({
          filename: `${collectionName}.json`,
          name: displayName,
          description: displayDesc,
          count: getCollectionShortcutsCount(data),
          groupCount: includedGroups.length,
          date: getFileDate(collectionFile),
          included: includedGroupsStr,
          rawUrl: `[Raw](https://raw.githubusercontent.com/utags/utags-shared-shortcuts/main/zh-CN/collections/${collectionName}.json)`,
        })
      } catch (e) {
        console.error(`Error parsing collection ${collectionName}.json`, e)
      }
    }
  }

  let collectionTable =
    '| 集合名 | 文件名 | 描述 | shortcuts 个数 | 分组个数 | 包含分组 | 最后更新时间 | 下载链接 |\n'
  collectionTable +=
    '| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- |\n'
  collectionRows.forEach((row) => {
    const fileLink = `[${row.filename}](https://github.com/utags/utags-shared-shortcuts/blob/main/zh-CN/collections/${row.filename})`
    collectionTable += `| ${row.name} | ${fileLink} | ${row.description} | ${row.count} | ${row.groupCount} | ${row.included} | ${row.date} | ${row.rawUrl} |\n`
  })

  // 3. Update README.md
  let readmeContent = fs.readFileSync(README_FILE, 'utf8')

  // Regex to find the "分组列表" section and replace content until the next section or end
  // We assume the structure is ## 分组列表 \n\n [tables...] \n\n ## [Next Section]
  // Or just replace the existing table.

  // Strategy:
  // 1. Find "## 分组列表"
  // 2. Find the next "## " header
  // 3. Replace the text in between with our new tables

  const sectionHeader = '## 分组列表'
  const startIdx = readmeContent.indexOf(sectionHeader)

  if (startIdx !== -1) {
    const nextSectionIdx = readmeContent.indexOf(
      '\n## ',
      startIdx + sectionHeader.length
    )
    const endIdx = nextSectionIdx !== -1 ? nextSectionIdx : readmeContent.length

    const preContent = readmeContent.substring(
      0,
      startIdx + sectionHeader.length
    )
    const postContent = readmeContent.substring(endIdx)

    const newContent = `${preContent}\n\n### 单个分组\n\n${singleTable}\n### 聚合集合\n\n${collectionTable}\n${postContent}`

    fs.writeFileSync(README_FILE, newContent, 'utf8')
    console.log('README.md updated successfully.')
  } else {
    console.error('Could not find "## 分组列表" section in README.md')
  }
} catch (e) {
  console.error('Error updating README:', e)
  process.exit(1)
}

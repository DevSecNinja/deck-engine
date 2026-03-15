import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

function parseVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Unsupported semver value: ${value}`)
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function compareVersion(left, right) {
  if (left.major !== right.major) return left.major - right.major
  if (left.minor !== right.minor) return left.minor - right.minor
  return left.patch - right.patch
}

function formatVersion(value) {
  return `${value.major}.${value.minor}.${value.patch}`
}

function getPublishedVersion(packageName) {
  const npmCommand = process.platform === 'win32'
    ? `npm view ${packageName} version`
    : `npm view ${packageName} version`
  const raw = execSync(npmCommand, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  }).trim()

  if (!raw) {
    throw new Error(`npm view returned an empty version for ${packageName}`)
  }

  return raw
}

const localVersion = parseVersion(packageJson.version)
const publishedVersionRaw = getPublishedVersion(packageJson.name)
const publishedVersion = parseVersion(publishedVersionRaw)

if (compareVersion(localVersion, publishedVersion) > 0) {
  console.log(`Local version ${packageJson.version} is already ahead of npm ${publishedVersionRaw}`)
  process.exit(0)
}

const nextVersion = {
  major: publishedVersion.major,
  minor: publishedVersion.minor,
  patch: publishedVersion.patch + 1,
}

packageJson.version = formatVersion(nextVersion)
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)

console.log(`Updated ${packageJson.name} version from ${formatVersion(localVersion)} to ${packageJson.version} using npm latest ${publishedVersionRaw}`)
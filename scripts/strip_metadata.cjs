#!/usr/bin/env node
/**
 * Strip metadata from Windows EXE files using rcedit CLI
 * Usage: node strip_metadata.cjs [exe_path...]
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

function stripMetadata (exePath) {
    if (!fs.existsSync(exePath)) {
        console.log(`File not found: ${exePath}`)
        return false
    }

    const originalSize = fs.statSync(exePath).size
    console.log(`Processing: ${exePath} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`)

    try {
        // Use npx to run rcedit - most reliable cross-platform
        const rceditArgs = [
            'rcedit',
            exePath,
            '--set-version-string', 'ProductName', ' ',
            '--set-version-string', 'FileDescription', ' ',
            '--set-version-string', 'CompanyName', ' ',
            '--set-version-string', 'LegalCopyright', ' ',
            '--set-version-string', 'OriginalFilename', ' ',
            '--set-version-string', 'InternalName', ' ',
            '--set-version-string', 'Comments', ' ',
            '--set-product-version', '0.0.0',
            '--set-file-version', '0.0.0'
        ]

        console.log(`Running: npx ${rceditArgs.join(' ')}`)

        const result = spawnSync('npx', rceditArgs, {
            stdio: 'inherit',
            shell: true
        })

        if (result.status !== 0) {
            console.error(`rcedit exited with code ${result.status}`)
            return false
        }

        const newSize = fs.statSync(exePath).size
        console.log(`Done: ${path.basename(exePath)} (${(newSize / 1024 / 1024).toFixed(2)} MB)`)

        // Verify file wasn't corrupted (allow up to 50% reduction for metadata removal)
        if (newSize < originalSize * 0.5) {
            console.error(`WARNING: File size reduced significantly! Original: ${originalSize}, New: ${newSize}`)
            return false
        }

        return true
    } catch (error) {
        console.error(`Error stripping ${exePath}:`, error.message)
        return false
    }
}

function main () {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        // Default: find and process all EXEs in known locations
        const nsisDir = 'src-tauri/target/release/bundle/nsis'
        const mainExe = 'src-tauri/target/release/antigravity_tools.exe'

        let processed = 0
        let success = true

        // Process NSIS installer
        if (fs.existsSync(nsisDir)) {
            console.log(`Found NSIS directory: ${nsisDir}`)
            const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe'))
            console.log(`Found ${files.length} EXE files`)
            for (const file of files) {
                const result = stripMetadata(path.join(nsisDir, file))
                success = success && result
                processed++
            }
        } else {
            console.log(`NSIS directory not found: ${nsisDir}`)
        }

        // Process main EXE
        if (fs.existsSync(mainExe)) {
            const result = stripMetadata(mainExe)
            success = success && result
            processed++
        } else {
            console.log(`Main EXE not found: ${mainExe}`)
        }

        if (processed === 0) {
            console.log('No EXE files found to process')
            // Don't fail if no files found
            process.exit(0)
        }

        process.exit(success ? 0 : 1)
    } else {
        // Process specified files
        let success = true
        for (const exePath of args) {
            const result = stripMetadata(exePath)
            success = success && result
        }
        process.exit(success ? 0 : 1)
    }
}

main()

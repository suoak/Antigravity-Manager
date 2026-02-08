#!/usr/bin/env node
/**
 * Strip metadata from Windows EXE files using rcedit CLI
 * Usage: node strip_metadata.cjs [exe_path...]
 */

const { spawnSync } = require('child_process')
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
        // Use require to get rcedit module directly instead of npx
        const rcedit = require('rcedit')

        console.log('Using rcedit module directly...')

        // Use Promise with sync wrapper
        const result = rcedit(exePath, {
            'version-string': {
                'ProductName': ' ',
                'FileDescription': ' ',
                'CompanyName': ' ',
                'LegalCopyright': ' ',
                'OriginalFilename': ' ',
                'InternalName': ' ',
                'Comments': ' '
            },
            'product-version': ' ',
            'file-version': ' '
        })

        // rcedit returns a promise, we need to handle it synchronously
        // Since we're in a sync context, we'll use a different approach
        return true
    } catch (error) {
        console.error(`Error with rcedit module: ${error.message}`)
        console.log('Falling back to CLI approach...')

        // Fallback: use node_modules/.bin/rcedit directly
        const rceditPath = path.join(process.cwd(), 'node_modules', 'rcedit', 'bin', 'rcedit.js')

        if (!fs.existsSync(rceditPath)) {
            console.error(`rcedit not found at: ${rceditPath}`)
            return false
        }

        const args = [
            rceditPath,
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

        console.log(`Running: node ${args.join(' ')}`)

        const result = spawnSync('node', args, {
            stdio: 'inherit'
        })

        if (result.status !== 0) {
            console.error(`rcedit exited with code ${result.status}`)
            return false
        }
    }

    const newSize = fs.statSync(exePath).size
    console.log(`Done: ${path.basename(exePath)} (${(newSize / 1024 / 1024).toFixed(2)} MB)`)

    // Verify file wasn't corrupted
    if (newSize < originalSize * 0.5) {
        console.error(`WARNING: File size reduced significantly! Original: ${originalSize}, New: ${newSize}`)
        return false
    }

    return true
}

async function stripMetadataAsync (exePath) {
    if (!fs.existsSync(exePath)) {
        console.log(`File not found: ${exePath}`)
        return false
    }

    const originalSize = fs.statSync(exePath).size
    console.log(`Processing: ${exePath} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`)

    try {
        const rcedit = require('rcedit')

        await rcedit(exePath, {
            'version-string': {
                'ProductName': ' ',
                'FileDescription': ' ',
                'CompanyName': ' ',
                'LegalCopyright': ' ',
                'OriginalFilename': ' ',
                'InternalName': ' ',
                'Comments': ' '
            },
            'product-version': '0.0.0',
            'file-version': '0.0.0'
        })

        const newSize = fs.statSync(exePath).size
        console.log(`Done: ${path.basename(exePath)} (${(newSize / 1024 / 1024).toFixed(2)} MB)`)

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

async function main () {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        const nsisDir = 'src-tauri/target/release/bundle/nsis'
        const mainExe = 'src-tauri/target/release/antigravity_tools.exe'

        let processed = 0
        let success = true

        if (fs.existsSync(nsisDir)) {
            console.log(`Found NSIS directory: ${nsisDir}`)
            const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('.exe'))
            console.log(`Found ${files.length} EXE files`)
            for (const file of files) {
                const result = await stripMetadataAsync(path.join(nsisDir, file))
                success = success && result
                processed++
            }
        } else {
            console.log(`NSIS directory not found: ${nsisDir}`)
        }

        if (fs.existsSync(mainExe)) {
            const result = await stripMetadataAsync(mainExe)
            success = success && result
            processed++
        } else {
            console.log(`Main EXE not found: ${mainExe}`)
        }

        if (processed === 0) {
            console.log('No EXE files found to process')
            process.exit(0)
        }

        process.exit(success ? 0 : 1)
    } else {
        let success = true
        for (const exePath of args) {
            const result = await stripMetadataAsync(exePath)
            success = success && result
        }
        process.exit(success ? 0 : 1)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})

#!/usr/bin/env node
/**
 * Strip metadata from Windows EXE files using @electron/rcedit
 * Usage: node strip_metadata.js <exe_path>
 */

const rcedit = require('@electron/rcedit')
const path = require('path')
const fs = require('fs')

async function stripMetadata (exePath) {
    if (!fs.existsSync(exePath)) {
        console.log(`File not found: ${exePath}`)
        return false
    }

    console.log(`Stripping metadata from: ${exePath}`)

    try {
        await rcedit(exePath, {
            'version-string': {
                ProductName: '',
                FileDescription: '',
                CompanyName: '',
                LegalCopyright: '',
                OriginalFilename: '',
                InternalName: '',
                Comments: ''
            },
            'product-version': '0.0.0',
            'file-version': '0.0.0'
        })
        console.log(`Done: ${path.basename(exePath)}`)
        return true
    } catch (error) {
        console.error(`Error stripping ${exePath}:`, error.message)
        return false
    }
}

async function main () {
    const args = process.argv.slice(2)

    if (args.length === 0) {
        // Default: find and process all EXEs in known locations
        const nsisDir = 'src-tauri/target/release/bundle/nsis'
        const mainExe = 'src-tauri/target/release/antigravity_tools.exe'

        let success = true

        // Process NSIS installer
        if (fs.existsSync(nsisDir)) {
            const files = fs.readdirSync(nsisDir).filter(f => f.endsWith('-setup.exe'))
            for (const file of files) {
                const result = await stripMetadata(path.join(nsisDir, file))
                success = success && result
            }
        }

        // Process main EXE
        if (fs.existsSync(mainExe)) {
            const result = await stripMetadata(mainExe)
            success = success && result
        }

        process.exit(success ? 0 : 1)
    } else {
        // Process specified files
        let success = true
        for (const exePath of args) {
            const result = await stripMetadata(exePath)
            success = success && result
        }
        process.exit(success ? 0 : 1)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})

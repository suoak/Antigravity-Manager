#!/usr/bin/env node
/**
 * Strip metadata from Windows EXE files using Resource Hacker
 * 
 * Resource Hacker can safely delete version resources from PE files,
 * including NSIS installers, without corrupting the file structure.
 * 
 * Usage: node strip_metadata.cjs [exe_path...]
 */

const { execSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')

const RESHACKER_URL = 'https://www.angusj.com/resourcehacker/resource_hacker.zip'
const RESHACKER_DIR = path.join(process.cwd(), 'tools', 'reshacker')
const RESHACKER_EXE = path.join(RESHACKER_DIR, 'ResourceHacker.exe')

async function downloadFile (url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest)
        const protocol = url.startsWith('https') ? https : http

        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject)
                return
            }
            response.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
        }).on('error', (err) => {
            fs.unlink(dest, () => { })
            reject(err)
        })
    })
}

async function ensureResourceHacker () {
    if (fs.existsSync(RESHACKER_EXE)) {
        console.log('Resource Hacker found.')
        return true
    }

    console.log('Downloading Resource Hacker...')

    try {
        fs.mkdirSync(RESHACKER_DIR, { recursive: true })

        const zipPath = path.join(RESHACKER_DIR, 'reshacker.zip')
        await downloadFile(RESHACKER_URL, zipPath)

        // Extract using PowerShell
        const extractCmd = `Expand-Archive -Path "${zipPath}" -DestinationPath "${RESHACKER_DIR}" -Force`
        execSync(`powershell -Command "${extractCmd}"`, { stdio: 'inherit' })

        if (fs.existsSync(RESHACKER_EXE)) {
            console.log('Resource Hacker installed successfully.')
            fs.unlinkSync(zipPath)
            return true
        } else {
            console.error('Resource Hacker extraction failed.')
            return false
        }
    } catch (error) {
        console.error('Failed to download Resource Hacker:', error.message)
        return false
    }
}

function stripMetadata (exePath) {
    if (!fs.existsSync(exePath)) {
        console.log(`File not found: ${exePath}`)
        return false
    }

    const originalSize = fs.statSync(exePath).size
    console.log(`Processing: ${exePath} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`)

    try {
        // Use Resource Hacker to delete version info resource
        // Resource type 16 is RT_VERSION (version information)
        const result = spawnSync(RESHACKER_EXE, [
            '-open', exePath,
            '-save', exePath,
            '-action', 'delete',
            '-mask', 'VERSIONINFO,,'
        ], {
            stdio: 'inherit'
        })

        if (result.status !== 0) {
            console.error(`Resource Hacker exited with code ${result.status}`)
            // Continue anyway, might just mean no resource was found
        }

        const newSize = fs.statSync(exePath).size
        console.log(`Done: ${path.basename(exePath)} (${(newSize / 1024 / 1024).toFixed(2)} MB)`)

        // Verify file wasn't corrupted (should be very close to original size)
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

    // Ensure Resource Hacker is available
    if (!await ensureResourceHacker()) {
        console.error('Cannot proceed without Resource Hacker.')
        process.exit(1)
    }

    if (args.length === 0) {
        const nsisDir = 'src-tauri/target/release/bundle/nsis'
        const mainExe = 'src-tauri/target/release/antigravity_tools.exe'
        // Also check for exe with spaces in name (product name)
        const altMainExe = 'src-tauri/target/release/Antigravity Tools.exe'

        let processed = 0
        let success = true

        // Process main EXE first (before NSIS packages it)
        console.log('--- Processing Main EXE ---')
        if (fs.existsSync(mainExe)) {
            console.log(`Found main EXE: ${mainExe}`)
            const result = stripMetadata(mainExe)
            success = success && result
            processed++
        } else if (fs.existsSync(altMainExe)) {
            console.log(`Found main EXE (alt): ${altMainExe}`)
            const result = stripMetadata(altMainExe)
            success = success && result
            processed++
        } else {
            console.log(`Main EXE not found at: ${mainExe}`)
            console.log(`Also checked: ${altMainExe}`)
            // List what's in the release directory
            const releaseDir = 'src-tauri/target/release'
            if (fs.existsSync(releaseDir)) {
                const exeFiles = fs.readdirSync(releaseDir).filter(f => f.endsWith('.exe'))
                console.log(`EXE files in ${releaseDir}: ${exeFiles.join(', ') || 'none'}`)
            }
        }

        // Process NSIS installer
        console.log('--- Processing NSIS Installer ---')
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

        if (processed === 0) {
            console.log('No EXE files found to process')
            process.exit(0)
        }

        process.exit(success ? 0 : 1)
    } else {
        let success = true
        for (const exePath of args) {
            const result = stripMetadata(exePath)
            success = success && result
        }
        process.exit(success ? 0 : 1)
    }
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})

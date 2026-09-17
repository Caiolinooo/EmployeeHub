
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export interface ChangelogRelease {
    version: string;
    date: string;
    majorChanges: string[];
    minorChanges: string[];
    bugFixes: string[];
    content: string; // Full raw content for the release
}

export async function GET() {
    try {
        const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');

        if (!fs.existsSync(changelogPath)) {
            return NextResponse.json({ error: 'CHANGELOG.md not found' }, { status: 404 });
        }

        const fileContent = fs.readFileSync(changelogPath, 'utf8');
        const releases = parseChangelog(fileContent);

        if (releases.length === 0) {
            return NextResponse.json({
                latest: null,
                history: []
            });
        }

        return NextResponse.json({
            latest: releases[0],
            history: releases
        });

    } catch (error) {
        console.error('Error reading changelog:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

function parseChangelog(content: string): ChangelogRelease[] {
    const releases: ChangelogRelease[] = [];

    // Split by version headers (## [X.X.X] - YYYY-MM-DD or similar)
    // Regex looks for: ## [version] - date
    const versionRegex = /^##\s+\[([0-9]+\.[0-9]+\.[0-9]+)\]\s+-\s+(\d{4}-\d{2}-\d{2})/gm;

    let match;
    const indices: { version: string, date: string, index: number }[] = [];

    while ((match = versionRegex.exec(content)) !== null) {
        indices.push({
            version: match[1],
            date: match[2],
            index: match.index
        });
    }

    for (let i = 0; i < indices.length; i++) {
        const start = indices[i].index;
        const end = indices[i + 1] ? indices[i + 1].index : content.length;
        const fullSection = content.substring(start, end).trim();

        // Extract sections based on headers
        // We want to capture lists under headers like "Major Changes", "Minor Changes", "Bug Fixes", "Updates"

        // "Major Changes" or "Adicionado" -> majorChanges
        let majorChanges = extractListItems(fullSection, 'Major Changes');
        if (majorChanges.length === 0) majorChanges = extractListItems(fullSection, 'Adicionado');

        // "Minor Changes" or "Melhorado" -> minorChanges
        let minorChanges = extractListItems(fullSection, 'Minor Changes');
        if (minorChanges.length === 0) minorChanges = extractListItems(fullSection, 'Melhorado');

        // "Bug Fixes" or "Corrigido" -> bugFixes
        let bugFixes = extractListItems(fullSection, 'Bug Fixes');
        if (bugFixes.length === 0) bugFixes = extractListItems(fullSection, 'Corrigido');

        // If no specific sections matched, try to just grab all bullet points from the section
        // excluding the version header itself
        const customContent = fullSection; // Could be used for custom markdown rendering if we want

        releases.push({
            version: indices[i].version,
            date: indices[i].date,
            majorChanges,
            minorChanges,
            bugFixes,
            content: fullSection
        });
    }

    return releases;
}

function extractListItems(sectionContent: string, headerName: string): string[] {
    // Regex to find a header like "### Header Name" and capture content until next header
    // Note: Headers might be ### or ####
    const headerRegex = new RegExp(`#{3,4}\\s+.*${headerName}.*\\n([\\s\\S]*?)(?=(^#{3,4})|$)`, 'im');
    const match = headerRegex.exec(sectionContent);

    if (!match || !match[1]) return [];

    const content = match[1];
    const items: string[] = [];

    // Extract bullet points
    const bulletRegex = /^\s*[-*+]\s+(.+)$/gm;
    let itemMatch;
    while ((itemMatch = bulletRegex.exec(content)) !== null) {
        items.push(itemMatch[1].trim());
    }

    return items;
}

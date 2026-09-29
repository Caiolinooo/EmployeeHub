/**
 * SMB Service - Serviço para conexão e navegação em shares SMB
 * Utiliza @marsaud/smb2 para se conectar a servidores Windows
 */

import SMB2 from '@marsaud/smb2';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Encryption config
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const key = process.env.SMB_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || 'default-smb-key-change-me-asap!';
    // Derive a 32-byte key
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts a password for storage
 */
export function encryptPassword(password: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a stored password
 */
export function decryptPassword(encryptedPassword: string): string {
    const key = getEncryptionKey();
    const parts = encryptedPassword.split(':');

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted password format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export interface SmbConnectionConfig {
    host: string;
    share: string;
    domain?: string;
    username: string;
    password: string;
    port?: number;
}

export interface SmbFileInfo {
    name: string;
    path: string;
    isDirectory: boolean;
    size?: number;
    lastModified?: Date;
}

export class SmbService {
    private client: any = null;
    private config: SmbConnectionConfig;

    constructor(config: SmbConnectionConfig) {
        this.config = config;
    }

    /**
     * Creates and returns an SMB2 client
     */
    private getClient(): any {
        if (!this.client) {
            const sharePath = `\\\\${this.config.host}\\${this.config.share}`;

            // Aceita usuario nos formatos "DOMINIO\\usuario" ou "usuario@dominio.com"
            // e separa dominio/username antes de montar a autenticacao NTLM.
            let username = this.config.username;
            let domain = this.config.domain || '';
            if (username.includes('\\')) {
                const parts = username.split('\\');
                if (!domain) domain = parts[0];
                username = parts[1];
            } else if (username.includes('@')) {
                const parts = username.split('@');
                username = parts[0];
                if (!domain) domain = parts[1];
            }

            // Normalize domain for NTLM: strip FQDN suffixes (.local, .com, etc.) and uppercase
            if (domain.includes('.')) {
                domain = domain.split('.')[0];
            }
            domain = domain.toUpperCase();

            console.log(`[SMB] Connecting to: ${sharePath}, domain: ${domain || '(vazio)'}, user: ${username}, port: ${this.config.port || 445}`);

            this.client = new SMB2({
                share: sharePath,
                domain: domain,
                username: username,
                password: this.config.password,
                port: this.config.port || 445,
                autoCloseTimeout: 30000, // 30 seconds
            });
        }
        return this.client;
    }

    /**
     * Tests the connection by listing the root directory
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const client = this.getClient();

            return new Promise((resolve) => {
                client.readdir('', (err: { message?: string; code?: string } | null, files: string[]) => {
                    if (err) {
                        const code = err.message || err.code || 'Erro desconhecido';
                        const hints: Record<string, string> = {
                            'STATUS_LOGON_FAILURE': 'Usuário ou senha inválidos. Use o formato DOMINIO\\usuario (ex.: GROUPABZ\\joao).',
                            'STATUS_ACCESS_DENIED': 'Sem permissão no compartilhamento. Verifique os direitos do usuário na pasta.',
                            'STATUS_BAD_NETWORK_NAME': 'Compartilhamento não encontrado. Confira o nome do share (ex.: DATA-ABZ).',
                            'STATUS_INVALID_PARAMETER': 'Parâmetro inválido na autenticação. Informe o domínio (ex.: GROUPABZ) ou use DOMINIO\\usuario.',
                        };
                        const hint = Object.entries(hints).find(([k]) => code.includes(k))?.[1];
                        resolve({
                            success: false,
                            message: `Falha na conexão: ${code}${hint ? ' — ' + hint : ''}`
                        });
                    } else {
                        resolve({
                            success: true,
                            message: `Conexão estabelecida! ${files.length} itens encontrados na raiz.`
                        });
                    }
                });
            });
        } catch (error: any) {
            return {
                success: false,
                message: `Erro ao conectar: ${error.message}`
            };
        }
    }

    /**
     * Lists files and directories at the given path
     */
    async listFiles(path: string = ''): Promise<SmbFileInfo[]> {
        const client = this.getClient();
        const normalizedPath = path.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            client.readdir(normalizedPath, (err: any, files: string[]) => {
                if (err) {
                    reject(new Error(`Erro ao listar diretório "${path}": ${err.message || err.code}`));
                    return;
                }

                // Map file names to SmbFileInfo objects
                const fileInfoPromises = files.map(async (fileName: string) => {
                    const filePath = normalizedPath ? `${normalizedPath}\\${fileName}` : fileName;

                    // Try to determine if it's a directory by attempting to list it
                    const isDir = await this.isDirectory(filePath).catch(() => false);

                    return {
                        name: fileName,
                        path: filePath.replace(/\\/g, '/'),
                        isDirectory: isDir,
                    } as SmbFileInfo;
                });

                Promise.all(fileInfoPromises)
                    .then(resolve)
                    .catch(reject);
            });
        });
    }

    /**
     * Checks if a path is a directory
     */
    private async isDirectory(path: string): Promise<boolean> {
        const client = this.getClient();

        return new Promise((resolve) => {
            client.readdir(path, (err: any) => {
                resolve(!err);
            });
        });
    }

    /**
     * Reads a file from the SMB share
     */
    async readFile(path: string): Promise<Buffer> {
        const client = this.getClient();
        const normalizedPath = path.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            client.readFile(normalizedPath, (err: any, data: Buffer) => {
                if (err) {
                    reject(new Error(`Erro ao ler arquivo "${path}": ${err.message || err.code}`));
                    return;
                }
                resolve(data);
            });
        });
    }

    /**
     * Writes (uploads) a file to the SMB share
     */
    async writeFile(path: string, data: Buffer): Promise<void> {
        const client = this.getClient();
        const normalizedPath = path.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            client.writeFile(normalizedPath, data, (err: any) => {
                if (err) {
                    reject(new Error(`Erro ao gravar arquivo "${path}": ${err.message || err.code}`));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Creates a directory in the SMB share
     */
    async mkdir(path: string): Promise<void> {
        const client = this.getClient();
        const normalizedPath = path.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            client.mkdir(normalizedPath, (err: any) => {
                // STATUS_OBJECT_NAME_COLLISION = pasta já existe → idempotente
                if (err && !(err.message || err.code || '').includes('COLLISION')) {
                    reject(new Error(`Erro ao criar pasta "${path}": ${err.message || err.code}`));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Deletes a file or empty directory in the SMB share
     */
    async delete(path: string, isDirectory: boolean): Promise<void> {
        const client = this.getClient();
        const normalizedPath = path.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            const cb = (err: any) => {
                if (err) {
                    reject(new Error(`Erro ao excluir "${path}": ${err.message || err.code}`));
                    return;
                }
                resolve();
            };
            if (isDirectory) client.rmdir(normalizedPath, cb);
            else client.unlink(normalizedPath, cb);
        });
    }

    /**
     * Renames/moves a file or directory in the SMB share
     */
    async rename(oldPath: string, newPath: string): Promise<void> {
        const client = this.getClient();
        const normalizedOld = oldPath.replace(/\//g, '\\');
        const normalizedNew = newPath.replace(/\//g, '\\');

        return new Promise((resolve, reject) => {
            client.rename(normalizedOld, normalizedNew, (err: any) => {
                if (err) {
                    reject(new Error(`Erro ao renomear "${oldPath}": ${err.message || err.code}`));
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Recursively lists all files in a directory
     */
    async listAllFiles(basePath: string = ''): Promise<SmbFileInfo[]> {
        const allFiles: SmbFileInfo[] = [];

        const processDir = async (dirPath: string) => {
            try {
                const items = await this.listFiles(dirPath);

                for (const item of items) {
                    if (item.isDirectory) {
                        await processDir(item.path);
                    } else {
                        allFiles.push(item);
                    }
                }
            } catch (error) {
                console.error(`Erro ao processar diretório "${dirPath}":`, error);
            }
        };

        await processDir(basePath);
        return allFiles;
    }

    /**
     * Disconnects from the SMB share
     */
    disconnect(): void {
        if (this.client) {
            try {
                this.client.close();
            } catch (e) {
                // Ignore close errors
            }
            this.client = null;
        }
    }
}

/**
 * Local Filesystem Service - Reads files from local paths or UNC paths
 * Alternative to SMB2 for environments where NTLM is not supported (Windows Server 2025+)
 */
export class LocalFsService {
    private basePath: string;

    constructor(localPath: string) {
        // Normalize path separators
        this.basePath = localPath.replace(/\//g, '\\');
    }

    /**
     * Tests the connection by checking if the path exists and is readable
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {

            const resolvedPath = path.resolve(this.basePath);
            console.log(`[LocalFS] Testing path: ${resolvedPath}`);

            const stats = await fs.stat(resolvedPath);
            if (!stats.isDirectory()) {
                return { success: false, message: `O caminho não é um diretório: ${resolvedPath}` };
            }

            const files = await fs.readdir(resolvedPath);
            return {
                success: true,
                message: `Conexão local estabelecida! ${files.length} itens encontrados em "${resolvedPath}".`
            };
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return { success: false, message: `Caminho não encontrado: ${this.basePath}` };
            }
            if (error.code === 'EACCES' || error.code === 'EPERM') {
                return { success: false, message: `Sem permissão de acesso: ${this.basePath}` };
            }
            return { success: false, message: `Erro ao acessar: ${error.message}` };
        }
    }

    /**
     * Lists files and directories at the given path
     */
    async listFiles(subPath: string = ''): Promise<SmbFileInfo[]> {

        const fullPath = subPath
            ? path.join(this.basePath, subPath.replace(/\//g, '\\'))
            : this.basePath;

        try {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            return entries.map(entry => ({
                name: entry.name,
                path: subPath ? `${subPath}/${entry.name}` : entry.name,
                isDirectory: entry.isDirectory(),
            }));
        } catch (error: any) {
            throw new Error(`Erro ao listar diretório "${subPath || '(raiz)'}": ${error.message}`);
        }
    }

    /**
     * Reads a file from the local path
     */
    async readFile(filePath: string): Promise<Buffer> {

        const fullPath = path.join(this.basePath, filePath.replace(/\//g, '\\'));

        try {
            return await fs.readFile(fullPath);
        } catch (error: any) {
            throw new Error(`Erro ao ler arquivo "${filePath}": ${error.message}`);
        }
    }

    /**
     * Resolves a subPath safely inside basePath (blocks ".." traversal)
     */
    private async resolveSafe(subPath: string): Promise<string> {
        const fullPath = path.resolve(this.basePath, subPath.replace(/\//g, '\\'));
        // path.resolve() mantém separador final em raiz UNC (\\host\share\) — normalizar
        const root = path.resolve(this.basePath).replace(/[\\/]+$/, '');
        if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
            throw new Error(`Caminho fora da raiz permitida: ${subPath}`);
        }
        return fullPath;
    }

    /**
     * Writes (uploads) a file to the local path
     */
    async writeFile(filePath: string, data: Buffer): Promise<void> {
        const fullPath = await this.resolveSafe(filePath);
        try {
            await fs.writeFile(fullPath, data);
        } catch (error: any) {
            throw new Error(`Erro ao gravar arquivo "${filePath}": ${error.message}`);
        }
    }

    /**
     * Creates a directory in the local path (recursive, idempotent)
     */
    async mkdir(dirPath: string): Promise<void> {
        const fullPath = await this.resolveSafe(dirPath);
        try {
            await fs.mkdir(fullPath, { recursive: true });
        } catch (error: any) {
            throw new Error(`Erro ao criar pasta "${dirPath}": ${error.message}`);
        }
    }

    /**
     * Deletes a file or directory in the local path
     */
    async delete(targetPath: string, isDirectory: boolean): Promise<void> {
        const fullPath = await this.resolveSafe(targetPath);
        try {
            await fs.rm(fullPath, { recursive: isDirectory, force: false });
        } catch (error: any) {
            throw new Error(`Erro ao excluir "${targetPath}": ${error.message}`);
        }
    }

    /**
     * Renames/moves a file or directory in the local path
     */
    async rename(oldPath: string, newPath: string): Promise<void> {
        const fullOld = await this.resolveSafe(oldPath);
        const fullNew = await this.resolveSafe(newPath);
        try {
            await fs.rename(fullOld, fullNew);
        } catch (error: any) {
            throw new Error(`Erro ao renomear "${oldPath}": ${error.message}`);
        }
    }

    /**
     * Recursively lists all files in a directory
     */
    async listAllFiles(basePath: string = ''): Promise<SmbFileInfo[]> {
        const allFiles: SmbFileInfo[] = [];

        const processDir = async (dirPath: string) => {
            try {
                const items = await this.listFiles(dirPath);
                for (const item of items) {
                    if (item.isDirectory) {
                        await processDir(item.path);
                    } else {
                        allFiles.push(item);
                    }
                }
            } catch (error) {
                console.error(`[LocalFS] Erro ao processar diretório "${dirPath}":`, error);
            }
        };

        await processDir(basePath);
        return allFiles;
    }

    /**
     * No-op for local FS (no connection to close)
     */
    disconnect(): void {
        // Nothing to do
    }
}

/**
 * Creates an SmbService from a database connection record
 */
export function createSmbServiceFromConfig(config: {
    host: string;
    share: string;
    domain?: string;
    username: string;
    password_encrypted: string;
    port?: number;
}): SmbService {
    return new SmbService({
        host: config.host,
        share: config.share,
        domain: config.domain,
        username: config.username,
        password: decryptPassword(config.password_encrypted),
        port: config.port,
    });
}

/**
 * Factory: creates the appropriate service (LocalFs or SMB) based on config
 */
export function createServiceFromConfig(config: {
    host: string;
    share: string;
    domain?: string;
    username: string;
    password_encrypted: string;
    port?: number;
    local_path?: string;
}): SmbService | LocalFsService {
    if (config.local_path) {
        console.log(`[SMB Connector] Using local filesystem mode: ${config.local_path}`);
        return new LocalFsService(config.local_path);
    }
    console.log(`[SMB Connector] Using SMB2 mode: \\\\${config.host}\\${config.share}`);
    return createSmbServiceFromConfig(config);
}

/**
 * Gets the MIME type based on file extension
 */
export function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        csv: 'text/csv',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
}

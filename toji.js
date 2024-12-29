import './config.js';
import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import * as ws from 'ws';
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, rmSync, watch } from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import dotenv from 'dotenv';
dotenv.config();
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import { format } from 'util';
import P from 'pino';
import pino from 'pino';
import Pino from 'pino';
import { Boom } from '@hapi/boom';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import store from './lib/store.js';
const { proto } = (await import('@whiskeysockets/baileys')).default;
const { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, Browsers, makeCacheableSignalKeyStore, jidNormalizedUser, PHONENUMBER_MCC } = await import('@whiskeysockets/baileys');
import readline from 'readline';
import NodeCache from 'node-cache';
const { CONNECTING } = ws;
const { chain } = lodash;

const PORT = process.env.PORT || 3000; // Load port from .env or default to 3000

protoType();
serialize();

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; 
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true));
}; 
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({...query, ...(apikeyqueryname ? {[apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name]} : {})})) : '');

global.timestamp = { start: new Date };

const __dirname = global.__dirname(import.meta.url);

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎z/#$%.\\-').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']');

global.db = new Low(new JSONFile(`storage/databases/database.json`));
global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
    if (!global.db.READ) {
      clearInterval(this);
      resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
    }
  }, 1 * 1000));
  if (global.db.data !== null) return;
  global.db.READ = true;
  await global.db.read().catch(console.error);
  global.db.READ = null;
  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  };
  global.db.chain = chain(global.db.data);
};
loadDatabase();

global.authFile = `sessions`;
const { state, saveCreds } = await useMultiFileAuthState(global.authFile);

const { version } = await fetchLatestBaileysVersion();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver));

console.info = () => {};
const logger = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
}).child({ class: "client" });
logger.level = "fatal";

const connectionOptions = {
  version: [2, 3000, 1015901307],
  logger,
  printQRInTerminal: false,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger),
  },
  browser: Browsers.ubuntu("Chrome"),
  markOnlineOnclientect: false,
  generateHighQualityLinkPreview: true,
  syncFullHistory: true,
  retryRequestDelayMs: 10,
  transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 10 },
  defaultQueryTimeoutMs: undefined,
  maxMsgRetryCount: 15,
  appStateMacVerification: {
    patch: false,
    snapshot: false,
  },
  getMessage: async (key) => {
    const jid = jidNormalizedUser(key.remoteJid);
    const msg = await store.loadMessage(jid, key.id);

    return msg?.message || "";
  },
};

global.conn = makeWASocket(connectionOptions);

if (!conn.authState.creds.registered) {
  const phoneNumber = await question(chalk.blue('ENTER YOUR WHATSAPP NUMBER👑\n'));
  
  if (conn.requestPairingCode) {
    let code = await conn.requestPairingCode(phoneNumber);
    code = code?.match(/.{1,4}/g)?.join("-") || code;
    console.log(chalk.cyan(`the 😑code is:`, code));
  } else {
  }
}

conn.isInit = false;
conn.well = false;

if (!opts['test']) {
  if (global.db) {
    setInterval(async () => {
      if (global.db.data) await global.db.write();
      if (opts['autocleartmp'] && (global.support || {}).find) (tmp = [os.tmpdir(), 'tmp', 'serbot'], tmp.forEach((filename) => cp.spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete'])));
    }, 30 * 1000);
  }
}

function clearTmp() {
  const tmp = [join(__dirname, './tmp')];
  const filename = [];
  tmp.forEach((dirname) => readdirSync(dirname).forEach((file) => filename.push(join(dirname, file))));
  return filename.map((file) => {
    const stats = statSync(file);
    if (stats.isFile() && (Date.now() - stats.mtimeMs >= 1000 * 60 * 3)) return unlinkSync(file);
    return false;
  });
}

setInterval(async () => {
  if (stopped === 'close' || !conn || !conn.user) return;
  const a = await clearTmp();
}, 180000);

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update;
  global.stopped = connection;
  if (isNewLogin) conn.isInit = true;
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    await global.reloadHandler(true).catch(console.error);
    global.timestamp.connect = new Date;
  }
  if (global.db.data == null) loadDatabase();
  if (connection == 'open') {
    console.log(chalk.yellow('Connected successfully.'));
    if (conn.user.id) {
      // Notify the given phone number with the connection status
      await conn.sendMessage('2349134457509@s.whatsapp.net', {
        text: 'ŧøɉɨ mđ ȼønnɇȼŧɇđ sᵾȼȼɇssfᵾłłɏ👑.',
      });
    }
  }
  let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
  if (reason == 405) {
    await fs.unlinkSync("./sessions/" + "creds.json");
    console.log(chalk.bold.redBright(`Connection replaced, please wait a moment while I restart...`)); 
    process.send('reset');
  }
  if (connection === 'close') {
    if (reason === DisconnectReason.badSession) {
      conn.logger.error(`Incorrect session, please delete the folder ${global.authFile} and scan again.`);
    } else if (reason === DisconnectReason.connectionClosed) {
      conn.logger.warn(`Connection closed, reconnecting...`);
      await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.connectionLost) {
      conn.logger.warn(`Connection lost with the server, reconnecting...`);
      await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.connectionReplaced) {
      conn.logger.error(`Connection replaced, a new session has been opened. Please close the current session first.`);
    } else if (reason === DisconnectReason.loggedOut) {
      conn.logger.error(`Connection closed, please delete the folder ${global.authFile} and scan again.`);
    } else if (reason === DisconnectReason.restartRequired) {
      conn.logger.info(`Restart required, please restart the server if you encounter any issues.`);
      await global.reloadHandler(true).catch(console.error);
    } else if (reason === DisconnectReason.timedOut) {
      conn.logger.warn(`Connection timed out, reconnecting...`);
      await global.reloadHandler(true).catch(console.error);
    } else {
      conn.logger.warn(`Unknown disconnection reason. ${reason || ''}: ${connection || ''}`);
      await global.reloadHandler(true).catch(console.error);
    }
  }
}

process.on('uncaughtException', console.error);

let isInit = true;
let handler = await import('./handler.js');
global.reloadHandler = async function(restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
    if (Object.keys(Handler || {}).length) handler = Handler;
  } catch (e) {
    console.error(e);
  }
  if (restatConn) {
    const oldChats = global.conn.chats;
    try {
      global.conn.ws.close();
    } catch { }
    conn.ev.removeAllListeners();
    global.conn = makeWASocket(connectionOptions, { chats: oldChats });
    isInit = true;
  }
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler);
    conn.ev.off('connection.update', conn.connectionUpdate);
    conn.ev.off('creds.update', conn.credsUpdate);
  }

  conn.handler = handler.handler.bind(global.conn);
  conn.connectionUpdate = connectionUpdate.bind(global);
};

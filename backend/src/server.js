import {readConfig} from './config.js';
import {connectDatabase} from './database.js';
import {createApp} from './app.js';
import {startBackend} from './start-backend.js';
let backend;
try{
 const config=readConfig();backend=await startBackend(config,{connectDatabase,createApp});
 console.log(`API: http://${config.host}:${config.port} | MongoDB: connected (${config.database})`);
}catch(error){
 if(error.code==='EADDRINUSE')console.error('Backend port is already in use. If Tile Studio is already running, use that server; otherwise stop its other terminal before starting again.');
 else if(error.code==='EACCES')console.error('Backend port access was denied. Check the port configuration and permissions.');
 else console.error('Backend could not start. Check MongoDB is running and the connection settings in backend/.env.');
 process.exitCode=1;
}
async function shutdown(){try{await backend?.close();process.exitCode=0;}catch{process.exitCode=1;}}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
